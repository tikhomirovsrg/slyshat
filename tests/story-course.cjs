const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/story-course/course-v1.json'))),{initializeDatabase}=require('../lib/db-migrations.mjs'),{migrateStoryCourse}=require('../lib/story-course-migration.mjs');
const state=require('../app/story-course-state.ts');
test('Every course story has complete branching routes, level-balanced order and matching recordings',()=>require('../scripts/story-course/validate.cjs'));
test('Course migration from schema 5 is idempotent and preserves original progress and audio results',()=>{
 const db=new DatabaseSync(':memory:');try{
  initializeDatabase(db);db.exec('DROP TABLE story_course_entries; DROP TABLE story_course_releases; PRAGMA user_version=5;');
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('kept-user','23','Learner','2026-10-21');db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?)').run('kept-user','{"audioPractice":{"original":"result"}}',7,'kept-mutation','2026-10-21');
  const tables=['users','study_profiles','progress','runs','content_stories','audio_content_stories'],before=tables.map(t=>db.prepare('SELECT * FROM '+t).all());
  assert.equal(initializeDatabase(db).courseSeeded,true);assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);assert.deepEqual(tables.map(t=>db.prepare('SELECT * FROM '+t).all()),before);assert.equal(initializeDatabase(db).courseSeeded,false);assert.equal(db.prepare('SELECT count(*) n FROM story_course_entries').get().n,2000);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'story-course-'));try{const changed=structuredClone(source);changed.stories[0].title='Wrong version';const file=path.join(dir,'changed.json');fs.writeFileSync(file,JSON.stringify(changed));assert.throws(()=>migrateStoryCourse(db,file),/new releaseId/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
 }finally{db.close();}
});
test('Sequential route crosses levels and resume respects in-progress and finished stories',()=>{
 const items=source.stories.filter(s=>s.language==='it');assert.equal(state.nextStory(items,items[199].id).position,201);assert.equal(state.nextStory(items,items[999].id),null);assert.equal(state.resumeStory(items).position,1);
 const p=state.newJourneyProgress(),j={active:{it:items[99].id},stories:{[items[99].id]:p}};assert.equal(state.resumeStory(items,j).position,100);p.finishedAt=new Date().toISOString();assert.equal(state.resumeStory(items,j).position,101);assert.equal(state.storyFinished(items[0],undefined,{[items[0].id]:{finishedAt:'old'}}),true);
 p.completedAt=p.finishedAt;p.finishedAt=null;assert.equal(state.storyFinished(items[99],j),true);assert.equal(state.resumeStory(items,j).position,100);
});
test('Different choices have different consequences, and profile validation rejects malformed routes',()=>{
 const s=source.stories.find(s=>!s.legacy),a=state.storyRoute(s,[0,0]),b=state.storyRoute(s,[1,0]);assert.notEqual(a.at(-1),b.at(-1));assert.notEqual(s.nodes[a.at(-1)].outcome.body,s.nodes[b.at(-1)].outcome.body);assert.throws(()=>state.storyRoute(s,[9]));
 const {validateProfile,freshProfile}=require('../app/profile-types.ts'),p=freshProfile();p.journey={active:{en:s.id},stories:{[s.id]:state.newJourneyProgress()}};assert.deepEqual(validateProfile(p),p);assert.throws(()=>validateProfile({...p,journey:{...p.journey,stories:{[s.id]:{...p.journey.stories[s.id],path:[-1]}}}}));
});
test('Original story position and completion survive adoption of the comic course',()=>{
 const s=source.stories.find(s=>s.legacy),{fresh}=require('../app/learning.ts');const p=fresh(s.id);p.started=true;p.phase='dialogue';p.node=s.nodes.start.choices[0].next;
 const migrated=state.legacyJourney(s,p);assert.equal(state.storyRoute(s,migrated.path).at(-1),p.node);
 p.finishedAt='2026-10-21T12:00:00.000Z';assert.equal(state.legacyJourney(s,p).completedAt,p.finishedAt);
});
test('Comic scene keeps target text hidden and decisions disabled until listening or reading',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ComicStory}=require('../app/story-course.tsx');const raw=source.stories.find(s=>!s.legacy),base=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/audio-library/series-v1.json')));
 const story={...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([id,n])=>[id,{...n,clips:n.clips.map(ref=>({id:ref.id,...(ref.set==='course'?source:base).segments[ref.id],source:'/audio/course/en-a1-v1.mp3',startAt:0,endAt:10}))}]))};
 const profile={data:{journey:undefined,events:[]},ready:true,status:'synced',conflict:false,update(){}};
 const html=renderToStaticMarkup(React.createElement(ComicStory,{story,profile,speed:1,onSpeed(){},next:null,onNext(){},onClose(){}}));assert(!html.includes(story.nodes.start.clips[0].text));assert(html.includes('Слушать сцену'));assert.equal((html.match(/class="comic-choice" disabled/g)||[]).length,2);assert(!html.includes('Правильный ответ'));
 assert(html.includes('С начала'));assert(html.includes('aria-label="Скорость озвучки"'));assert(html.includes('value="0.5"'));assert(html.includes('value="1.5"'));
});

test('Restart clears only the current attempt, retaining completion and every opened ending',()=>{
 const s=source.stories.find(s=>!s.legacy),at='2026-10-21T12:00:00.000Z';
 for(const finished of [false,true]){
  const p={path:[1,0],heard:['start','b'],assisted:['b-message'],finishedAt:finished?at:null,completedAt:at,endings:['a-together'],updatedAt:at};
  const snapshot=structuredClone(p),reset=state.restartJourney(p,'b-message');assert.deepEqual(p,snapshot);
  assert.deepEqual(reset.path,[]);assert.deepEqual(reset.heard,[]);assert.deepEqual(reset.assisted,[]);assert.equal(reset.finishedAt,null);assert.equal(reset.completedAt,at);
  assert.deepEqual(reset.endings,finished?['a-together','b-message']:['a-together']);assert.deepEqual(state.storyRoute(s,reset.path),[s.start]);
  assert(state.storyFinished(s,{active:{},stories:{[s.id]:reset}}));assert.deepEqual(state.restartJourney(reset,s.start).endings,reset.endings);
 }
 const first=state.restartJourney({...state.newJourneyProgress(),path:[0]},'a');assert(!first.completedAt);assert(!state.storyFinished(s,{active:{},stories:{[s.id]:first}}));
});

test('Scene art follows the chosen branch and speaker without revealing dialogue text',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{default:Art,sceneVisual}=require('../app/comic-scene-art.tsx');
 const raw=source.stories.find(s=>!s.legacy),base=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/audio-library/series-v1.json')));
 const story={...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([id,n])=>[id,{...n,clips:n.clips.map(ref=>({id:ref.id,...(ref.set==='course'?source:base).segments[ref.id]}))}]))};
 const draw=(nodeId,path,playing=false,voice)=>renderToStaticMarkup(React.createElement(Art,{story,nodeId,path,playing,voice}));
 const opening=draw('start',[]),a=draw('a',[0]),b=draw('b',[1]),message=draw('a-message',[0,0]),together=draw('a-together',[0,1]);
 assert.equal(new Set([opening,a,b,message,together]).size,5);assert.equal(sceneVisual(story,'a-message',[0,0]).prop,'phone');assert.equal(sceneVisual(story,'a-together',[0,1]).prop,'conversation');
 const speaking=draw('start',[],true,story.nodes.start.clips[0].voice);assert(speaking.includes('is-speaking'));assert(!opening.includes('is-speaking'));
 for(const node of Object.values(story.nodes))for(const c of node.clips)assert(!opening.includes(c.text));
});
