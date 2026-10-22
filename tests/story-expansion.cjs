const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {readExpansion,expansionRoutes,expansionExerciseSource}=require('../lib/story-expansion.mjs');
const {buildStoryExercises,gradeStoryExercise}=require('../lib/story-exercises.mjs');
const {validateExpansionAudio}=require('../lib/story-expansion-audio.mjs');
const release=readExpansion(),castBytes=fs.readFileSync('content/characters/cast-v1.json'),cast=JSON.parse(castBytes),castHash=crypto.createHash('sha256').update(castBytes).digest('hex');

test('The active catalogue has 150 stories and 30 at each level per language; old IDs remain addressable',()=>{
 const {DatabaseSync}=require('node:sqlite'),{initializeDatabase}=require('../lib/db-migrations.mjs'),dbModule=require('../lib/db.ts'),old=dbModule.getDb,db=new DatabaseSync(':memory:');initializeDatabase(db);dbModule.getDb=()=>db;
 try{
  const {storyCatalog,courseStory}=require('../lib/story-course.ts'),{nextStory}=require('../app/story-course-state.ts');
  for(const language of ['en','it']){
   const catalog=storyCatalog(language,true);assert.equal(catalog.total,150);assert.equal(catalog.archived.length,973);
   assert.equal(new Set([...catalog.items,...catalog.archived].map(story=>story.id)).size,1123);
   assert.deepEqual(catalog.items.map(story=>story.position),Array.from({length:150},(_,i)=>i+1));
   for(const level of ['A1','A2','B1','B2','C1'])assert.equal(catalog.items.filter(story=>story.level===level).length,30);
   catalog.items.forEach((card,i)=>{assert.equal(courseStory(card.id).position,card.position);assert.equal(nextStory(catalog.items,card.id)?.id,catalog.items[i+1]?.id);});
   for(const card of catalog.archived)assert.equal(courseStory(card.id).id,card.id);
  }
  for(const raw of release.stories){
   const story=courseStory(raw.id);assert.equal(story.sourceAttribution.title,raw.source.title);assert.equal(story.sourceAttribution.author,raw.source.author);assert.equal(story.sourceAttribution.url,undefined);assert.equal(story.vocabulary.length,3);
   assert.equal(story.comic.actors.length,2);assert.equal(story.comic.playerActorId,raw.cast[0].actorId);
   for(const [nodeId,node] of Object.entries(story.nodes)){
    node.clips.forEach((clip,i)=>{assert.equal(clip.text,raw.nodes[nodeId].lines[i].text);assert.equal(clip.actorId,raw.cast[raw.nodes[nodeId].lines[i].speaker].actorId);if(story.audioMode==='recorded'){assert(clip.source.startsWith('/audio/expansion/'));assert(clip.endAt>clip.startAt);}else{assert.equal(story.audioMode,'text');assert.equal(clip.source,'');assert.equal(clip.endAt,0);}});
    for(const choice of node.choices){assert.equal(choice.clip.text,choice.text);assert.equal(choice.clip.actorId,raw.cast[0].actorId);assert.equal(!!choice.clip.source,story.audioMode==='recorded');}
   }
  }
 }finally{dbModule.getDb=old;db.close();}
});

test('All 492 new routes provide four source-bound exercises without revealing the other ending',()=>{
 let count=0;
 for(const raw of release.stories){
  const story=expansionExerciseSource(raw),routes=expansionRoutes(raw);assert.equal(routes.length,2);
  for(const route of routes){
   const set=buildStoryExercises(story,route.path);assert(set);assert.equal(set.version,2);assert.equal(set.questions.length,4);
   for(const question of set.questions){
    assert(gradeStoryExercise(question,question.answerIds));
    for(const evidence of question.evidence){assert(route.nodes.includes(evidence.nodeId));assert(story.nodes[evidence.nodeId].clips.some(clip=>clip.id===evidence.clipId));}
   }
   assert.equal(buildStoryExercises(story,route.path.slice(0,-1)),null);count++;
  }
  assert.notEqual(buildStoryExercises(story,routes[0].path).routeKey,buildStoryExercises(story,routes[1].path).routeKey);
 }
 assert.equal(count,492);
});

test('New audio rejects stale prose, swapped speakers, missing answers and invalid cue bounds',()=>{
 // Protocol fixture: no synthetic media is written or advertised as a release.
 const manifest={formatVersion:1,releaseId:'story-expansion-audio-v1',sourceSha256:release.checksum,castSha256:castHash,readyStories:246,sampleRate:24000,codec:'mp3',bitrate:64000,
  modelSha256:'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a',voicesSha256:'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d',
  levelSpeed:require('../lib/story-expansion-audio.mjs').EXPANSION_LEVEL_SPEED,files:{'protocol.mp3':{duration:2,bytes:32,sha256:'0'.repeat(64)}},segments:{}};
 const {expansionClipId,expansionChoiceId}=require('../lib/story-expansion.mjs');
 function add(id,text,actorId,story){const profile=cast.voiceProfiles[actorId+'-'+story.language];manifest.segments[id]={file:'protocol.mp3',start:0,end:1,storyId:story.id,textSha256:crypto.createHash('sha256').update(text).digest('hex'),actorId,voice:profile.voice,voiceProfileId:profile.id,language:story.language,speed:Number((profile.speed*manifest.levelSpeed[story.language][story.level]).toFixed(4))};}
 for(const story of release.stories)for(const [nodeId,node] of Object.entries(story.nodes)){
  node.lines.forEach((line,index)=>add(expansionClipId(story.id,nodeId,index),line.text,story.cast[line.speaker].actorId,story));
  node.choices.forEach((choice,index)=>add(expansionChoiceId(story.id,nodeId,index),choice.text,story.cast[0].actorId,story));
 }
 assert.equal(validateExpansionAudio(manifest,release,cast,castHash).readyStories,246);
 const key=Object.keys(manifest.segments).find(id=>id.includes(':choice:')),original=manifest.segments[key];
 for(const patch of [{textSha256:'0'.repeat(64)},{actorId:'unknown'},{end:original.start},{start:-1}]){
  manifest.segments[key]={...original,...patch};assert.throws(()=>validateExpansionAudio(manifest,release,cast,castHash));
 }
 delete manifest.segments[key];assert.throws(()=>validateExpansionAudio(manifest,release,cast,castHash),/speaker\/text/);manifest.segments[key]=original;
 assert.throws(()=>validateExpansionAudio({...manifest,sourceSha256:'0'.repeat(64)},release,cast,castHash),/release mismatch/);
 assert.throws(()=>validateExpansionAudio({...manifest,readyStories:245},release,cast,castHash),/release mismatch/);
});
