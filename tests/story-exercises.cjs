const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildStoryExercises,gradeStoryExercise,STORY_EXERCISES_RELEASE_ID}=require('../lib/story-exercises.mjs');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name));
const courseBytes=read('content/story-course/course-v1.json');
const libraryBytes=read('content/audio-library/series-v1.json');
const course=JSON.parse(courseBytes),library=JSON.parse(libraryBytes);
const bank=JSON.parse(read('content/story-exercises/bank-v1.json'));
const hydrate=raw=>({...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([id,node])=>[id,{...node,clips:node.clips.map(ref=>({id:ref.id,...(ref.set==='course'?course.segments:library.segments)[ref.id]}))}]))});
function* completePaths(story,nodeId=story.start,choices=[],nodes=[story.start]){
 const node=story.nodes[nodeId];
 if(!node.choices.length){yield {path:choices,route:nodes};return;}
 for(let i=0;i<node.choices.length;i++){
  const next=node.choices[i].next;assert(!nodes.includes(next),'source graph must be acyclic');
  yield* completePaths(story,next,[...choices,i],[...nodes,next]);
 }
}

test('exercise bank is anchored to unchanged sources and exact heard excerpts',()=>{
 assert.equal(bank.releaseId,STORY_EXERCISES_RELEASE_ID);
 assert.equal(bank.sourceCourseSha256,crypto.createHash('sha256').update(courseBytes).digest('hex'));
 assert.equal(bank.sourceLibrarySha256,crypto.createHash('sha256').update(libraryBytes).digest('hex'));
 assert.equal(Object.keys(bank.entries).length,290);
 assert.equal(Object.values(bank.entries).filter(x=>x.provenance.kind==='authored-course-start').length,40);
 for(const [id,entry] of Object.entries(bank.entries)){
  const source=course.segments[id]||library.segments[id];assert(source,id);
  assert.equal(entry.sourceText,source.text,id);
  assert(source.text.includes(entry.phrase.anchor),id);
  for(const question of [entry.fact,entry.phrase]){
   assert(question.options.length>=3&&question.options.length<=4);
   assert.equal(new Set(question.options).size,question.options.length);
   assert(Number.isInteger(question.answer)&&question.answer>=0&&question.answer<question.options.length);
   assert(question.prompt&&question.explanation);
  }
 }
});

test('all 2000 stories and every complete route have four valid, route-only exercises',()=>{
 const sourceSnapshot=JSON.stringify(course);let routes=0,stories=0;
 for(const raw of course.stories){
  const story=hydrate(raw);let storyRoutes=0;
  for(const {path,route} of completePaths(story)){
   const set=buildStoryExercises(story,path);assert(set,`${story.id}: ${path}`);
   assert.equal(set.storyId,story.id);assert.equal(set.version,1);
   assert.equal(set.routeKey,`${STORY_EXERCISES_RELEASE_ID}:${story.id}:${path.join('.')}`);
   assert.equal(set.questions.length,4);assert.equal(new Set(set.questions.map(q=>q.id)).size,4);
   assert.deepEqual(new Set(set.questions.map(q=>q.skill)),new Set(['comprehension','phrase','sequence']));
   for(const question of set.questions){
    assert(question.evidence.length>0);assert(question.explanation&&question.prompt);
    assert.equal(new Set(question.options.map(o=>o.id)).size,question.options.length);
    assert.equal(new Set(question.options.map(o=>o.text)).size,question.options.length);
    assert(gradeStoryExercise(question,question.answerIds));
    assert(!gradeStoryExercise(question,[]));
    assert(!gradeStoryExercise(question,['unknown-answer']));
    assert(!gradeStoryExercise(question,[...question.answerIds,question.answerIds[0]]));
    for(const ref of question.evidence){
     assert(route.includes(ref.nodeId),`unvisited node: ${story.id}/${ref.nodeId}`);
     assert(story.nodes[ref.nodeId].clips.some(clip=>clip.id===ref.clipId));
    }
    if(question.type==='sequence'){
     assert.equal(question.options.length,3);assert.equal(question.evidence.length,3);
     assert(!gradeStoryExercise(question,[...question.answerIds].reverse()));
     assert.notDeepEqual(question.options.map(o=>o.id),question.answerIds,'sequence is initially scrambled');
     assert.deepEqual(question.evidence.map(ref=>route.indexOf(ref.nodeId)),question.evidence.map(ref=>route.indexOf(ref.nodeId)).sort((a,b)=>a-b));
    }else{
     const wrong=question.options.find(o=>!question.answerIds.includes(o.id));
     assert(!gradeStoryExercise(question,[wrong.id]));
    }
   }
   const heardTranslations=new Set(route.flatMap(id=>story.nodes[id].clips.map(clip=>clip.ru)));
   for(const q of set.questions.filter(q=>['route-detail','route-sequence'].includes(q.id))){
    assert(q.options.every(o=>heardTranslations.has(o.text)),'dynamic alternatives must come only from this route');
   }
   routes++;storyRoutes++;
  }
  assert(storyRoutes>0);stories++;
 }
 assert.equal(stories,2000);assert.equal(routes,8125);
 assert.equal(JSON.stringify(course),sourceSnapshot,'generation does not mutate the source');
});

test('the actual choice changes the route detail without leaking the other branch',()=>{
 const story=hydrate(course.stories.find(s=>s.id==='story-en-a1-dinner-time'));
 const a=buildStoryExercises(story,[0,0]),b=buildStoryExercises(story,[1,0]);
 assert(a&&b);assert.notEqual(a.routeKey,b.routeKey);
 const detailA=a.questions.find(q=>q.id==='route-detail'),detailB=b.questions.find(q=>q.id==='route-detail');
 assert.equal(detailA.evidence[0].nodeId,'a');assert.equal(detailB.evidence[0].nodeId,'b');
 assert.notEqual(detailA.evidence[0].clipId,detailB.evidence[0].clipId);
 assert(!JSON.stringify(a).includes('en-A1-time-0'));
 assert(!JSON.stringify(b).includes('en-A1-time-decision'));
 const poisoned=structuredClone(story);
 for(const [id,node] of Object.entries(poisoned.nodes)){
  if(['start','a','a-message'].includes(id))continue;
  node.clips.forEach(clip=>{clip.text='UNSEEN_ENDING_SECRET';clip.ru='НЕОТКРЫТЫЙ_ФИНАЛ';});
  node.outcome={title:'UNSEEN_ENDING_SECRET',body:'НЕОТКРЫТЫЙ_ФИНАЛ'};
 }
 assert.deepEqual(buildStoryExercises(poisoned,[0,0]),a);
});

test('invalid, incomplete and changed-evidence routes fail closed',()=>{
 const story=hydrate(course.stories.find(s=>s.id==='story-en-a1-dinner-time'));
 for(const p of [[],[0],[-1],[999],[0,0,0],[0.5],['0'],Array(41).fill(0)])assert.equal(buildStoryExercises(story,p),null);
 assert.equal(buildStoryExercises(null,[]),null);
 const altered=structuredClone(story);altered.nodes.start.clips[0].text='Different evidence, old question would be unsafe.';
 assert.equal(buildStoryExercises(altered,[0,0]),null);
 const missing=structuredClone(story);delete missing.nodes.a.clips[0].ru;
 assert.equal(buildStoryExercises(missing,[0,0]),null);
 const loop=structuredClone(story);loop.nodes.start.choices[0].next='start';
 assert.equal(buildStoryExercises(loop,[0,0]),null);
});

test('results are deterministic and independent of voices, art, media URLs and profile',()=>{
 const story=hydrate(course.stories.find(s=>s.id==='museum-en'));
 const {path}=completePaths(story).next().value;
 const before=buildStoryExercises(story,path),decorated=structuredClone(story);
 decorated.comic={arbitrary:'changed'};
 for(const node of Object.values(decorated.nodes))for(const clip of node.clips){
  clip.voice='different';clip.source='/audio/another-release.mp3';clip.startAt=100;clip.endAt=110;clip.actorName='Another actor';
 }
 assert.deepEqual(buildStoryExercises(story,path),before);
 assert.deepEqual(buildStoryExercises(decorated,path),before);
});
