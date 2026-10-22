const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const root=path.resolve(__dirname,'..'),standalone=path.join(root,'.next/standalone');
if(!fs.existsSync(path.join(standalone,'server.js')))throw new Error('Run npm run build first.');
fs.cpSync(path.join(root,'.next/static'),path.join(standalone,'.next/static'),{recursive:true});fs.cpSync(path.join(root,'public'),path.join(standalone,'public'),{recursive:true});
// Mirror the runner-stage COPY instructions and exercise its real entrypoint.
for(const file of ['content/catalog-v1.json','content/practice-v2.json','content/audio-library/series-v1.json','content/story-course/course-v1.json','content/comics/comic-v1.json','content/characters/cast-v1.json','lib/character-cast.mjs','lib/character-migration.mjs','lib/comic-migration.mjs','lib/story-course-migration.mjs','lib/audio-library-migration.mjs','lib/db-migrations.mjs','scripts/migrate.mjs','scripts/docker-entrypoint.sh']){const dest=path.join(standalone,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
fs.cpSync(path.join(root,'content/story-expansion'),path.join(standalone,'content/story-expansion'),{recursive:true});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-http-'));
process.env.AUDIO_CACHE_PATH=path.join(dir,'audio');process.env.TTS_PROVIDER='google';process.env.GOOGLE_TTS_API_KEY='';process.env.TTS_DAILY_CHAR_LIMIT='0';
process.env.DATABASE_PATH=path.join(dir,'live.sqlite');process.env.APP_URL='http://localhost:3217';
const {freshProfile}=require('../app/profile-types.ts');
const {createSession,SESSION_COOKIE}=require('../lib/auth.ts'),{fresh}=require('../app/learning.ts'),{getDb}=require('../lib/db.ts');
let child;let output='';
async function start(){
 child=spawn('sh',['scripts/docker-entrypoint.sh','node','server.js'],{cwd:standalone,env:{...process.env,PORT:'3217',HOSTNAME:'127.0.0.1',NEXT_TELEMETRY_DISABLED:'1',YANDEX_CLIENT_ID:'',YANDEX_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('Server exited: '+output);try{const r=await fetch('http://127.0.0.1:3217/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server did not become ready: '+output);
}
async function stop(){if(!child||child.exitCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}
const request=(route,options={})=>fetch('http://127.0.0.1:3217'+route,{redirect:'manual',...options});
(async()=>{
 try{
  // A deterministic MP3 protocol fixture exercises the real cache/API with no
  // paid provider calls. It is not used to judge voice or playback quality.
  const {SpeechService}=require('../lib/speech-server.ts'),{speechCatalog}=require('../lib/speech-catalog.ts'),{getEpisode}=require('../app/episodes.ts');
  const audioInput={text:getEpisode('coffee-it').checkText,locale:'it-IT',voice:'aoede'};
  const audioBytes=Buffer.from([73,68,51,4,0,0,0,0,0,0,255,251]);
  const audioSeed=new SpeechService({directory:process.env.AUDIO_CACHE_PATH,apiKey:'fixture-not-a-key',dailyCharacters:1000,catalog:speechCatalog,fetcher:async()=>Response.json({audioContent:audioBytes.toString('base64')})});
  await audioSeed.speak(audioInput);audioSeed.close();
  await start();let r=await request('/');assert.equal(r.status,200);const html=await r.text();assert(html.includes('Слышать'));assert.equal((await request('/favicon.svg')).status,200);
  // Published audio is usable without a synthesis key and HTTP ranges support cue seeking.
  const crypto=require('node:crypto'),audioManifest=JSON.parse(fs.readFileSync(path.join(root,'public/audio/library/manifest.json')));
  for(const language of ['en','it'])for(const level of ['A1','A2','B1','B2','C1']){
   const catalog=await (await request('/api/audio/library?'+new URLSearchParams({language,level}))).json();assert.equal(catalog.total,200);assert.equal(catalog.counts[level],200);assert.equal(catalog.items.length,12);assert(catalog.items.every(s=>s.language===language&&s.level===level&&s.ready));
   const detail=await (await request('/api/audio/library?id='+catalog.items[0].id)).json();assert.equal(detail.segments.length,4);assert.equal(detail.questions.length,3);
  }
  const empty=await (await request('/api/audio/library?language=it&q=nosuchstory')).json();assert.equal(empty.total,0);
  const last=await (await request('/api/audio/library?language=en&level=C1&page=9999')).json();assert.equal(last.page,last.pages);assert.equal(last.items.length,8);
  assert.equal((await request('/api/audio/library?id=unknown')).status,404);
  let courseStory;const expansionSamples=[];
  for(const language of ['en','it']){
   const c=await (await request('/api/stories?language='+language)).json();assert.equal(c.total,150);assert.equal(c.archived,undefined);assert(c.items.every(s=>!s.archived&&s.comic?.cover&&s.comic?.hook&&!s.comic?.scenes));assert.equal(c.items.length,150);for(const item of c.items)for(const value of [item.title,item.topic,item.summary,item.comic.hook,item.comic.series])assert(!/\p{Script=Cyrillic}/u.test(value),'Story card must use '+language);assert.deepEqual(c.items.map(s=>s.position),Array.from({length:150},(_,i)=>i+1));for(const level of ['A1','A2','B1','B2','C1'])assert.equal(c.counts[level],30);
   const withArchive=await (await request('/api/stories?language='+language+'&includeArchived=1')).json();assert.equal(withArchive.total,150);assert.equal(withArchive.archived.length,973);assert(withArchive.archived.every(s=>s.archived&&!c.items.some(item=>item.id===s.id)));const savedStory=await (await request('/api/stories?id='+withArchive.archived[0].id)).json();assert(savedStory.archived);assert.equal(savedStory.vocabulary.length,3);assert(savedStory.nodes.start);
   courseStory=await (await request('/api/stories?id='+c.items.find(s=>s.id.startsWith('story-')).id)).json();assert(courseStory.comic);assert.equal(courseStory.vocabulary.length,3);assert(courseStory.vocabulary.every(entry=>entry.term&&entry.ru));assert.equal(courseStory.title,c.items.find(item=>item.id===courseStory.id).title);assert(!/\p{Script=Cyrillic}/u.test(courseStory.context));assert.deepEqual(Object.keys(courseStory.comic.scenes),Object.keys(courseStory.nodes));assert.equal(courseStory.nodes.start.choices.length,2);assert.equal(Object.values(courseStory.nodes).filter(n=>!n.choices.length).length,4);
   for(const level of ['A1','A2','B1','B2','C1']){
    const card=c.items.find(s=>s.level===level&&s.id.startsWith('new-'));assert(card);const story=await (await request('/api/stories?id='+card.id)).json();
    assert.equal(story.position,card.position);assert.equal(story.vocabulary.length,3);assert.equal(story.comic.actors.length,2);assert(story.sourceAttribution.title&&story.sourceAttribution.author);assert.equal(story.sourceAttribution.url,undefined);assert(story.authoredExercises);
    for(const node of Object.values(story.nodes)){for(const clip of node.clips){if(story.audioMode==='recorded'){assert(clip.source.startsWith('/audio/expansion/'));assert(clip.endAt>clip.startAt);}else{assert.equal(story.audioMode,'text');assert.equal(clip.source,'');assert.equal(clip.endAt,0);}assert(story.comic.actors.some(actor=>actor.id===clip.actorId));}for(const choice of node.choices){assert(choice.clip);assert.equal(choice.clip.actorId,story.comic.playerActorId);assert.equal(choice.clip.text,choice.text);}}
    if(story.audioMode==='recorded'){const audio=await request(story.nodes.start.clips[0].source,{headers:{Range:'bytes=0-31'}});assert.equal(audio.status,206);assert(audio.headers.get('cache-control').includes('immutable'));assert.equal((await audio.arrayBuffer()).byteLength,32);}else assert.equal(card.audioMode,'text');
    expansionSamples.push(story);
   }
   const original=await (await request('/api/stories?id='+c.items.find(s=>s.legacy).id)).json();assert(original.nodes.start.clips[0].source.startsWith(fs.existsSync(path.join(root,'public/audio/characters/manifest.json'))?'/audio/characters/':'/audio/course/'));assert.equal(original.comic.actors.length,2);assert(original.nodes.start.clips[0].actorId);
  }
  assert.equal((await request('/api/stories?id=unknown')).status,404);assert.equal((await request('/api/stories?language=de')).status,400);
  for(const asset of JSON.parse(fs.readFileSync(path.join(root,'public/comics/v1/manifest.json'))).assets)for(const file of asset.files){const response=await request('/comics/v1/'+file.file);assert.equal(response.status,200);assert(response.headers.get('cache-control').includes('immutable'));assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),file.sha256);}
  const characterCast=JSON.parse(fs.readFileSync(path.join(root,'content/characters/cast-v1.json')));
  for(const actor of Object.values(characterCast.actors)){
   const url=actor.artBase+(actor.artLayout==='sheet-2x2'?'-sheet.png':'-neutral.webp'),response=await request(url);
   assert.equal(response.status,200);assert(response.headers.get('cache-control').includes('immutable'));
   assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public',url))).digest('hex'));
  }
  const characterAudioPath=path.join(root,'public/audio/characters/manifest.json');
  if(fs.existsSync(characterAudioPath)){
   const manifest=JSON.parse(fs.readFileSync(characterAudioPath));assert.equal(manifest.readyStories,2000);
   for(const node of Object.values(courseStory.nodes))for(const choice of node.choices){assert(choice.clip);assert.equal(choice.clip.actorId,courseStory.comic.playerActorId);assert.equal(choice.clip.text,choice.text);}
   for(const [name,file] of Object.entries(manifest.files)){
    const response=await request('/audio/characters/'+name,{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert(response.headers.get('cache-control').includes('immutable'));assert.equal((await response.arrayBuffer()).byteLength,32);
    const full=await request('/audio/characters/'+name);assert.equal(full.status,200);const bytes=Buffer.from(await full.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
   }
  }
  const at='2026-10-21T12:00:00.000Z';let courseState={active:{it:courseStory.id},stories:{[courseStory.id]:{path:[1,0],heard:['start','b','b-message'],assisted:[],finishedAt:at,updatedAt:at}}};
  // Exercise the bank in the actual standalone server during profile save,
  // then verify that restarting a story discards only the current attempt.
  const {buildStoryExercises}=require('../lib/story-exercises.mjs'),{answerExercise}=require('../lib/story-exercise-state.ts');
  const exercises=buildStoryExercises(courseStory,courseState.stories[courseStory.id].path);assert(exercises);
  for(const question of exercises.questions)courseState.stories[courseStory.id]=answerExercise(exercises,courseState.stories[courseStory.id],question.id,question.answerIds,at);
  for(const story of expansionSamples){
   let node=story.start;const path=[],heard=[node];while(story.nodes[node].choices.length){path.push(0);node=story.nodes[node].choices[0].next;heard.push(node);}
   let progress={path,heard:story.audioMode==='text'?[]:heard,assisted:story.audioMode==='text'?heard:[],finishedAt:at,completedAt:at,endings:[node],updatedAt:at};const set=buildStoryExercises(story,path);assert.equal(set.releaseId,'story-exercises-v2');assert.equal(set.questions.length,4);
   for(const question of set.questions)progress=answerExercise(set,progress,question.id,question.answerIds,at);courseState.stories[story.id]=progress;
  }
  const courseManifest=JSON.parse(fs.readFileSync(path.join(root,'public/audio/course/manifest.json')));
  for(const [name,file] of Object.entries(courseManifest.files)){
   const response=await request('/audio/course/'+name,{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert(response.headers.get('cache-control').includes('immutable'));assert.equal((await response.arrayBuffer()).byteLength,32);
   const full=await request('/audio/course/'+name);assert.equal(full.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await full.arrayBuffer())).digest('hex'),file.sha256);
  }
  for(const [name,file] of Object.entries(audioManifest.files)){
   const response=await request('/audio/library/'+name,{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert(response.headers.get('cache-control').includes('immutable'));assert(response.headers.get('content-type').startsWith('audio/mpeg'));assert.equal((await response.arrayBuffer()).byteLength,32);
   const full=await request('/audio/library/'+name);assert.equal(full.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await full.arrayBuffer())).digest('hex'),file.sha256);
  }
  for(const sample of JSON.parse(fs.readFileSync(path.join(root,'public/audio/kokoro/manifest.json'))).files){const response=await request('/audio/kokoro/'+sample.file);assert.equal(response.status,200);assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),sample.sha256);}
  assert.equal((await request('/api/progress')).status,401);assert.equal((await request('/api/profile')).status,401);
  // Preview exposes public course content, never private account data or paid synthesis.
  assert.equal((await request('/?preview=1&lang=it&story=coffee-it')).status,200);
  for(const route of ['/api/progress','/api/profile']){
   assert.equal((await request(route+'?preview=1')).status,401);
   assert.equal((await request(route+'?preview=1',{method:'POST',headers:{Origin:process.env.APP_URL,'Content-Type':'application/json'},body:'{}'})).status,401);
  }
  assert.equal((await request('/api/audio?preview=1',{method:'POST',headers:{Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify(audioInput)})).status,401);
  r=await request('/api/auth/yandex/callback?state=invalid&code=unused');assert.equal(r.status,307);assert(r.headers.get('location').endsWith('?auth_error=failed'));
  const token=createSession({yandexId:'99123',label:'HTTP test'}),cookie=SESSION_COOKIE+'='+token;
  let snapshot=await (await request('/api/progress',{headers:{Cookie:cookie}})).json();assert(snapshot.account.id);assert.equal(snapshot.records.length,0);
  const audioHeaders={Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'};
  const audioRequest=(input=audioInput,headers=audioHeaders)=>request('/api/audio',{method:'POST',headers,body:JSON.stringify(input)});
  assert.equal((await audioRequest(audioInput,{...audioHeaders,Cookie:''})).status,401);
  assert.equal((await audioRequest(audioInput,{...audioHeaders,Origin:'https://foreign.example'})).status,403);
  assert.equal((await audioRequest({...audioInput,text:'Private draft'})).status,400);
  assert.equal((await audioRequest({...audioInput,voice:'puck'})).status,503); // Missing key, no implicit fallback.
  const audioConfig=await (await request('/api/audio/config')).json();assert.deepEqual([audioConfig.provider,audioConfig.ready],['google',false]);
  r=await audioRequest();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'audio/mpeg');assert.deepEqual(Buffer.from(await r.arrayBuffer()),audioBytes);
  const state={...fresh('coffee-it'),started:true,phase:'dialogue',speed:1.25,voiceMaya:'cloud:kore',voiceOliver:'cloud:puck'};const {extraQuestions}=require('../app/extra-practice.ts');const extra=extraQuestions('coffee-it');for(const q of extra)state.practice.answers[q.id]={value:q.answer,correct:true,checkedAt:new Date().toISOString(),...(q.audio?{listened:true,assisted:q===extra[0]}:{})};state.practice.draft='Il mio testo viene salvato sul server.';
  r=await request('/api/progress',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({accountId:snapshot.account.id,progress:state,baseRevision:0,mutationId:'http-mutation-001'})});assert.equal(r.status,200);
  r=await request('/api/profile',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({accountId:snapshot.account.id,data:{...freshProfile(),goal:'work',journey:courseState,audioPractice:{'it-a1-dinner-time':{completedAt:'2026-10-20T12:00:00.000Z',correct:2,total:3,assisted:true}}},baseRevision:0,mutationId:'profile-http-001'})});assert.equal(r.status,200);
  // A restart on device one retains completed endings and is loaded by device two.
  const savedProfile=(await (await request('/api/profile',{headers:{Cookie:cookie}})).json()).record;
  assert.deepEqual(savedProfile.data.journey.stories[courseStory.id].exercises,courseState.stories[courseStory.id].exercises);
  const {restartJourney}=require('../app/story-course-state.ts');
  courseState={...courseState,stories:{...courseState.stories,[courseStory.id]:restartJourney(courseState.stories[courseStory.id],'b-message')}};
  assert.equal(courseState.stories[courseStory.id].finishedAt,null);assert.equal(courseState.stories[courseStory.id].completedAt,at);assert.deepEqual(courseState.stories[courseStory.id].endings,['b-message']);
  assert.equal(courseState.stories[courseStory.id].exercises,undefined);
  r=await request('/api/profile',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({accountId:snapshot.account.id,data:{...savedProfile.data,journey:courseState},baseRevision:savedProfile.revision,mutationId:'profile-restart-002'})});assert.equal(r.status,200);
  const second=SESSION_COOKIE+'='+createSession({yandexId:'99123',label:'HTTP test'});
  await stop();await start();r=await audioRequest();assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),audioBytes);snapshot=await (await request('/api/progress',{headers:{Cookie:second}})).json();assert.equal(snapshot.records[0].progress.phase,'dialogue');assert.equal(snapshot.records[0].progress.speed,1.25);assert.equal(snapshot.records[0].progress.voiceMaya,'cloud:kore');assert.equal(snapshot.records[0].progress.voiceOliver,'cloud:puck');assert.deepEqual(snapshot.records[0].progress.practice,state.practice);const profile=await (await request('/api/profile',{headers:{Cookie:second}})).json();assert.equal(profile.record.data.goal,'work');assert.deepEqual(profile.record.data.journey,courseState);assert.equal(profile.record.data.audioPractice['it-a1-dinner-time'].correct,2);assert.equal(profile.record.data.audioPractice['it-a1-dinner-time'].assisted,true);
  r=await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL}});assert.equal(r.status,303);assert.equal((await request('/api/progress',{headers:{Cookie:cookie}})).status,401);assert.equal((await request('/api/progress',{headers:{Cookie:second}})).status,200);
  const backup=execFileSync(process.execPath,[path.join(root,'scripts/backup.mjs')],{env:process.env,maxBuffer:64*1024*1024});assert.equal(backup.subarray(0,15).toString(),'SQLite format 3');
  const restored=path.join(dir,'restored.sqlite');execFileSync(process.execPath,[path.join(root,'scripts/restore.mjs'),'--confirm-app-stopped'],{env:{...process.env,DATABASE_PATH:restored},input:backup});
  const {DatabaseSync}=require('node:sqlite');let db=new DatabaseSync(restored);assert.equal(db.prepare('SELECT count(*) AS n FROM progress').get().n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM study_profiles').get().n,1);assert.equal(JSON.parse(db.prepare('SELECT data FROM study_profiles').get().data).goal,'work');assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM study_profiles').get().data).journey,courseState);assert.equal(db.prepare('SELECT count(*) n FROM story_course_entries').get().n,2000);assert.equal(db.prepare('SELECT count(*) n FROM comic_boards').get().n,2000);assert.equal(db.prepare('SELECT count(*) n FROM story_character_cast').get().n,2000);db.close();
  db=new DatabaseSync(restored);assert.equal(db.prepare('SELECT count(*) n FROM audio_content_stories').get().n,2000);assert.equal(db.prepare('SELECT count(*) n FROM audio_content_segments').get().n,420);assert.equal(JSON.parse(db.prepare('SELECT data FROM study_profiles').get().data).audioPractice['it-a1-dinner-time'].correct,2);assert.equal(db.prepare('SELECT count(*) n FROM content_stories').get().n,200);assert.equal(db.prepare('SELECT count(*) n FROM project_documents').get().n,1);assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);assert.equal(db.prepare('SELECT count(*) n FROM content_practice_sets').get().n,80);assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM progress').get().data).practice,state.practice);db.close();
  execFileSync(process.execPath,[path.join(root,'scripts/restore.mjs'),'--confirm-app-stopped','--archive-existing'],{env:{...process.env,DATABASE_PATH:restored},input:backup});assert(fs.readdirSync(dir).some(n=>n.startsWith('restored.sqlite.before-restore-')));
  console.log('PASS: 300 distinct active stories (30 per level/language), 1946 archived IDs, new cast, explicit reading/audio availability and branch exercises across profile save/restart/backup, 2000 audio variants and filters, all MP3 hashes, range seeking, audio results across sessions/restart/backup, audio authorization, origin and content allowlist, audio cache and voice preferences across restart, production HTTP, anonymous access denied, story, draft and profile save/load across sessions, persistence after restart, logout isolation, online backup, validated restore and previous-database preservation.');
 }catch(error){console.error(output);throw error;}finally{await stop();getDb().close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
