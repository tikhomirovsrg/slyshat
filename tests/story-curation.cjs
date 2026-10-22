const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const bytes=fs.readFileSync('content/story-course/course-v1.json'),course=JSON.parse(bytes),release=require('../content/story-curation/v1.json');
const hash=crypto.createHash('sha256').update(bytes).digest('hex'),{buildStoryCuration}=require('../lib/story-curation.ts'),{nextStory,resumeStory,newJourneyProgress}=require('../app/story-course-state.ts');
const {levels}=require('../app/study-types.ts');
const plot=story=>JSON.stringify(Object.entries(story.nodes).map(([id,node])=>[id,node.choices.map(choice=>choice.next),node.outcome||null]));

test('The curated catalogue retains one story per repeated plot family across topics and levels',()=>{
 const before=JSON.stringify(course),map=buildStoryCuration(course.stories,hash);
 assert.equal(map.size,2000);
 for(const language of ['en','it']){
  const rows=course.stories.filter(story=>story.language===language),active=rows.filter(story=>!map.get(story.id).archived);
  assert.equal(active.length,27);assert.equal(active.filter(story=>story.legacy).length,20);
  const variants=rows.filter(story=>!story.legacy),groups=new Map();
  for(const story of variants){const key=plot(story);groups.set(key,[...(groups.get(key)||[]),story.id]);}
  assert.equal(groups.size,8,'The eight families also share actual branch topology and outcomes across levels');
  for(const ids of groups.values())assert.equal(ids.filter(id=>!map.get(id).archived).length,ids[0].endsWith('-entrance')?0:1);
  assert.equal(active.filter(story=>!story.legacy).length,7,'The entrance family is withheld for an inconsistent timeline');
  const cards=active.map(story=>({...story,...map.get(story.id)})).sort((a,b)=>a.position-b.position);
  assert.deepEqual(cards.map(story=>story.position),Array.from({length:27},(_,index)=>index+1));
  assert(cards.every((story,index)=>!index||levels.indexOf(cards[index-1].level)<=levels.indexOf(story.level)));
  for(let index=0;index<cards.length-1;index++)assert.equal(nextStory(cards,cards[index].id).id,cards[index+1].id);
  assert.equal(nextStory(cards,cards.at(-1).id),null);
  const archived=rows.find(story=>map.get(story.id).archived),journey={active:{[language]:archived.id},stories:{[archived.id]:newJourneyProgress()}};
  assert.equal(resumeStory(cards,journey).id,cards[0].id);assert.equal(nextStory(cards,archived.id),null);
  assert.equal(journey.active[language],archived.id,'Do not transfer a saved route to a similar story');
 }
 assert.equal(JSON.stringify(course),before);
});

test('Curation rejects a second topic/level version of a retained plot and incompatible sources',()=>{
 assert.throws(()=>buildStoryCuration(course.stories,'changed-source'),/version mismatch/);
 const wrong=structuredClone(release),selected=wrong.stories.find(entry=>entry.family.startsWith('variant:'));
 const source=course.stories.find(story=>story.id===selected.id),duplicate=course.stories.find(story=>story.language===source.language&&!story.legacy&&story.id!==source.id&&plot(story)===plot(source));
 wrong.stories.push({...selected,id:duplicate.id,level:duplicate.level});
 assert.throws(()=>buildStoryCuration(course.stories,hash,wrong),/Repeated curated plot/);
 const missing=structuredClone(release);missing.stories[0].id='unknown';assert.throws(()=>buildStoryCuration(course.stories,hash,missing),/Invalid curated story/);
});

test('Archived story IDs and completed exercise attempts remain valid through the course API',()=>{
 const {DatabaseSync}=require('node:sqlite'),{initializeDatabase}=require('../lib/db-migrations.mjs'),dbModule=require('../lib/db.ts'),old=dbModule.getDb,db=new DatabaseSync(':memory:');initializeDatabase(db);dbModule.getDb=()=>db;
 try{
  const {storyCatalog,courseStory,validateCourseJourney}=require('../lib/story-course.ts');
  const active=storyCatalog('en');assert.equal(active.total,150);assert.equal(active.archived,undefined);
  const all=storyCatalog('en',true);assert.equal(all.archived.length,973);assert(all.items.every(story=>!story.archived));assert(all.archived.every(story=>story.archived));
  const story=courseStory(all.archived[0].id),raw=course.stories.find(item=>item.id===story.id);assert(story.archived);assert.equal(story.position,raw.position);assert.equal(story.vocabulary.length,3);
  const path=[0,0],at='2026-10-22T00:00:00.000Z',p={...newJourneyProgress(),path,heard:['start','a','a-message'],finishedAt:at,completedAt:at,updatedAt:at};
  const {buildStoryExercises}=require('../lib/story-exercises.mjs'),{answerExercise}=require('../lib/story-exercise-state.ts'),set=buildStoryExercises(story,path);
  const answered=set.questions.reduce((progress,question)=>answerExercise(set,progress,question.id,question.answerIds,at),p);
  const journey={active:{en:story.id},stories:{[story.id]:answered}},snapshot=JSON.stringify(journey);validateCourseJourney(journey);assert.equal(JSON.stringify(journey),snapshot);
  const changed=release.stories.find(item=>{const original=course.stories.find(story=>story.id===item.id);return original.level!==item.level;});assert(changed,'The release should apply reviewed level corrections');
  const revised=courseStory(changed.id);assert.equal(revised.level,changed.level);assert.equal(revised.vocabulary.length,3);assert(!revised.archived);
  assert.equal(course.stories.find(item=>item.id===changed.id).level,JSON.parse(bytes).stories.find(item=>item.id===changed.id).level);
 }finally{dbModule.getDb=old;db.close();}
});
