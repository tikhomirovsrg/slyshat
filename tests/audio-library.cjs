const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {initializeDatabase}=require('../lib/db-migrations.mjs');
const {migrateAudioLibrary}=require('../lib/audio-library-migration.mjs');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/audio-library/series-v1.json')));

test('All 2000 variants reference real audio and balanced, nonidentical, level-specific materials',()=>{require('../scripts/audio-library/validate.cjs');});

test('v4 migration adds audio materials once and preserves existing accounts and learning data',()=>{
 const db=new DatabaseSync(':memory:');try{
  initializeDatabase(db);db.exec('DROP TABLE audio_content_stories; DROP TABLE audio_content_segments; DROP TABLE audio_content_releases; PRAGMA user_version=4;');
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('audio-user','100','Learner','2026-10-20');
  db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?)').run('audio-user','{"preserve":"my work"}',9,'prior-mutation','2026-10-20');
  const tables=['users','progress','study_profiles','content_stories','content_practice_sets'];const before=tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());
  assert.equal(initializeDatabase(db).audioSeeded,true);assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);
  assert.deepEqual(tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all()),before);
  for(const lang of ['en','it'])for(const level of ['A1','A2','B1','B2','C1'])assert.equal(db.prepare('SELECT count(*) n FROM audio_content_stories WHERE language=? AND level=?').get(lang,level).n,200);
  assert.equal(initializeDatabase(db).audioSeeded,false);assert.equal(db.prepare('SELECT count(*) n FROM audio_content_segments').get().n,420);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-audio-seed-')),file=path.join(dir,'changed.json');
  try{const changed=structuredClone(source);changed.stories[0].title='Unversioned rewrite';fs.writeFileSync(file,JSON.stringify(changed));assert.throws(()=>migrateAudioLibrary(db,5,file),/new releaseId/);assert.equal(db.prepare('SELECT count(*) n FROM audio_content_stories').get().n,2000);}finally{fs.rmSync(dir,{recursive:true,force:true});}
 }finally{db.close();}
});

test('Profile validation retains audio results alongside older profiles and rejects impossible scores',()=>{
 const {freshProfile,validateProfile}=require('../app/profile-types.ts');const p=freshProfile();assert.deepEqual(validateProfile(p),p);
 const result={completedAt:'2026-10-20T12:00:00.000Z',correct:2,total:3,assisted:true};p.audioPractice={'it-a1-dinner-time':result};assert.deepEqual(validateProfile(JSON.parse(JSON.stringify(p))).audioPractice,p.audioPractice);
 for(const change of [{correct:4},{correct:-1},{total:5},{assisted:'no'},{completedAt:'bad date'}])assert.throws(()=>validateProfile({...p,audioPractice:{'it-a1-dinner-time':{...result,...change}}}),/audio result/);
});

test('Story practice hides transcript and explanations and disables questions until listening or reading',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{StoryPractice}=require('../app/audio-library.tsx');
 const s=source.stories[0],story={...s,duration:60,ready:true,segments:s.segments.map(id=>({id,...source.segments[id],source:'/audio/library/en-a1-v1.mp3',startAt:0,endAt:10}))};
 const profile={data:{levels:{en:'A1',it:'A1'}},ready:true,status:'synced'};
 const html=renderToStaticMarkup(React.createElement(StoryPractice,{story,speed:1,profile,onClose(){}}));
 assert(!html.includes(story.segments[0].text));assert(!html.includes(s.questions[0].explanation));assert(html.includes('Показать текст и перевод'));assert.equal((html.match(/<fieldset disabled/g)||[]).length,3);
});

test('Recorded audio never calls synthesis, respects cue boundaries, and cancellation cannot count as completion',async()=>{
 const originals={window:global.window,Audio:global.Audio,fetch:global.fetch};const audios=[];
 class FakeAudio{constructor(){this.currentTime=0;this.duration=100;audios.push(this);}play(){this.onloadedmetadata?.();this.onplaying?.();return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
 global.window={};global.Audio=FakeAudio;global.fetch=()=>{throw new Error('Static audio must not use TTS');};
 const {playSpeech,stopSpeech}=require('../lib/speech-player.ts');let completed=0;
 const options={source:'/audio/library/it-a1-v1.mp3',startAt:10,endAt:20,text:'Ciao',locale:'it-IT',speed:0.8,config:{provider:'device'},onEnd:()=>completed++};
 try{
  const a=playSpeech(options);assert.equal(audios[0].currentTime,10);assert.equal(audios[0].playbackRate,0.8);audios[0].currentTime=19;audios[0].ontimeupdate();assert.equal(completed,0);
  const b=playSpeech(options);assert.equal(await a.done,false);audios.at(-1).currentTime=20;audios.at(-1).ontimeupdate();assert.equal(await b.done,true);assert.equal(completed,1);
  const c=playSpeech(options);audios.at(-1).currentTime=15;audios.at(-1).onended();assert.equal(await c.done,false);assert.equal(completed,1);
 }finally{stopSpeech();Object.assign(global,originals);}
});

test('A full audio history still saves alongside 50 test runs and the 2000-event log',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-large-profile-'));process.env.DATABASE_PATH=path.join(dir,'db.sqlite');
 const {getDb}=require('../lib/db.ts'),{profileStore}=require('../lib/profile-store.ts'),{freshProfile}=require('../app/profile-types.ts');const db=getDb();
 try{
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('full-profile','555','Learner','2026-10-20');
  const p=freshProfile(),at='2026-10-20T12:00:00.000Z';p.audioPractice={};
  for(const s of source.stories)p.audioPractice[s.id]={completedAt:at,correct:3,total:3,assisted:false};
  const course=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/story-course/course-v1.json')));p.journey={active:{},stories:{}};
  for(const s of course.stories){let id=s.start;const route=[id],choices=[];while(s.nodes[id].choices.length){choices.push(0);id=s.nodes[id].choices[0].next;route.push(id);}p.journey.stories[s.id]={path:choices,heard:route,assisted:route,finishedAt:at,completedAt:at,endings:[id],updatedAt:at};}
  p.events=source.stories.map(s=>({id:'audio-library:'+s.id+':00000000-0000-0000-0000-000000000000',at,points:3}));
  p.tests=Array.from({length:50},(_,i)=>{const questionIds=Array.from({length:20},(_,j)=>'question-'+i+'-'+j);return {id:'test-'+i,kind:'control',language:'it',level:'B1',questionIds,finishedAt:at,answers:Object.fromEntries(questionIds.map(id=>[id,{value:'Una risposta di esempio per la verifica. '.repeat(4),correct:true,assisted:false,skill:'reading',checkedAt:at}]))};});
  assert(Buffer.byteLength(JSON.stringify(p))>650000);
  const saved=profileStore().save('full-profile',{data:p,baseRevision:0,mutationId:'large-profile-001'});assert.equal(saved.conflict,false);assert.deepEqual(profileStore().get('full-profile').data,p);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
