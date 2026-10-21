const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {getExerciseAttempt,answerExercise,assistExercises,restartExercises,exerciseSummary,validateExerciseAttempt}=require('../lib/story-exercise-state.ts');
const {validateJourney,restartJourney}=require('../app/story-course-state.ts');
const {buildStoryExercises}=require('../lib/story-exercises.mjs');
const at='2026-10-21T12:00:00.000Z';
const choice=id=>({id,type:'choice',skill:'comprehension',prompt:'Что произошло?',options:[{id:'yes',text:'Да'},{id:'no',text:'Нет'}],answerIds:['yes'],explanation:'Это сказано в истории.',evidence:[{nodeId:'end',clipId:'clip-end'}]});
const set={version:1,releaseId:'story-exercises-v1',storyId:'test-story',routeKey:'story-exercises-v1:test-story:0.0',questions:[choice('detail'),choice('meaning'),choice('fact'),{id:'order',type:'sequence',skill:'sequence',prompt:'Порядок событий',options:[{id:'first',text:'Первое'},{id:'second',text:'Второе'},{id:'third',text:'Третье'}],answerIds:['first','second','third'],explanation:'Порядок из диалога.',evidence:[{nodeId:'start',clipId:'clip-start'}]}]};
const progress=()=>({path:[0,0],heard:['start','a','end'],assisted:[],finishedAt:at,completedAt:at,endings:['end'],updatedAt:at});

test('Optional exercises resume after reload without changing completion, listening or other story state',()=>{
  const before=progress(),saved=answerExercise(set,before,'detail',['yes'],at);
  assert.equal(before.exercises,undefined);assert.deepEqual({...saved,exercises:undefined},{...before,exercises:undefined});
  const restored=JSON.parse(JSON.stringify(saved));validateJourney({active:{en:set.storyId},stories:{[set.storyId]:restored}});validateExerciseAttempt(set,restored);
  assert.deepEqual(getExerciseAttempt(set,restored),saved.exercises);assert.deepEqual(exerciseSummary(set,restored),{correct:1,total:4,answered:1,completed:false,assisted:false,replayed:false});
  const broken={...saved,exercises:{...saved.exercises,answers:{detail:null}}};assert.deepEqual(getExerciseAttempt(set,broken).answers,{});assert.equal(broken.finishedAt,at);assert.throws(()=>validateJourney({active:{en:set.storyId},stories:{[set.storyId]:broken}}),/exercise answer/);
  validateJourney({active:{en:set.storyId},stories:{[set.storyId]:before}});assert.equal(before.finishedAt,at);
});

test('All answers complete the exercise attempt, but errors never revoke the completed story',()=>{
  let p=progress();for(const q of set.questions)p=answerExercise(set,p,q.id,q.id==='detail'?['no']:q.answerIds,at);
  assert.equal(p.exercises.completedAt,at);assert.equal(exerciseSummary(set,p).correct,3);assert.equal(exerciseSummary(set,p).completed,true);assert.equal(p.finishedAt,at);assert.equal(p.completedAt,at);assert.deepEqual(p.heard,progress().heard);validateExerciseAttempt(set,p);
  assert.throws(()=>answerExercise(set,p,'unknown',['yes']),/Invalid exercise/);assert.throws(()=>answerExercise(set,p,'order',['first','first','third']),/Invalid exercise/);
  const forged=structuredClone(p);forged.exercises.answers.detail.correct=true;assert.throws(()=>validateExerciseAttempt(set,forged),/does not match/);assert.equal(getExerciseAttempt(set,forged).answers.detail.correct,false);assert.equal(exerciseSummary(set,forged).correct,3);
  const early=answerExercise(set,progress(),'detail',['yes'],at);early.exercises.completedAt=at;assert.throws(()=>validateExerciseAttempt(set,early),/completion/);
});

test('Routes that converge to the same ending cannot reuse a score; replaying a story removes only its current exercise attempt',()=>{
  const p=answerExercise(set,progress(),'detail',['yes'],at),branch={...p,path:[1,0]},branchSet={...set,routeKey:'story-exercises-v1:test-story:1.0'};
  assert.deepEqual(getExerciseAttempt(branchSet,branch).answers,{});assert.throws(()=>validateExerciseAttempt(branchSet,branch),/route or version/);
  const oldVersion={...p,exercises:{...p.exercises,version:'story-exercises-v0'}};assert.deepEqual(getExerciseAttempt(set,oldVersion).answers,{});assert.throws(()=>validateExerciseAttempt(set,oldVersion),/version/);
  const restarted=restartJourney(p,'end');assert.equal(restarted.exercises,undefined);assert.equal(restarted.finishedAt,null);assert.equal(restarted.completedAt,at);assert.deepEqual(restarted.endings,['end']);
  assert.throws(()=>answerExercise(set,restarted,'detail',['yes']),/finished story route/);
  assert.throws(()=>validateJourney({active:{en:set.storyId},stories:{[set.storyId]:{...p,finishedAt:null}}}),/finished story/);
});

test('Reading, replay and repeated checking remain assistance without inventing completed listening',()=>{
  const incompleteListening={...progress(),heard:['end']};assert(getExerciseAttempt(set,incompleteListening).assisted);const unsupported=answerExercise(set,incompleteListening,'detail',['yes'],at);unsupported.exercises.assisted=false;assert.throws(()=>validateExerciseAttempt(set,unsupported),/assistance/);assert.deepEqual(incompleteListening.heard,['end']);
  const read={...progress(),assisted:['a']};let p=answerExercise(set,read,'detail',['yes'],at);assert(p.exercises.assisted);assert(p.exercises.answers.detail.assisted);
  p=assistExercises(set,p,{replayed:true},at);assert(p.exercises.replayed);assert.deepEqual(p.heard,read.heard);assert.deepEqual(p.assisted,read.assisted);
  p=restartExercises(set,p,at);assert.deepEqual(p.exercises.answers,{});assert(p.exercises.assisted);assert(p.exercises.replayed);assert.equal(p.exercises.completedAt,undefined);assert.equal(p.finishedAt,at);
  p=answerExercise(set,p,'detail',['yes'],at);validateExerciseAttempt(set,p);
  const retry=answerExercise(set,answerExercise(set,progress(),'detail',['no'],at),'detail',['yes'],at);assert(retry.exercises.assisted);assert(retry.exercises.answers.detail.assisted);
  const bad=structuredClone(p);bad.exercises.assisted=false;assert.throws(()=>validateExerciseAttempt(set,bad),/assistance/);
});

test('A profile with exercises for all 2000 stories saves, reloads and rejects a forged route score',()=>{
  const {initializeDatabase}=require('../lib/db-migrations.mjs'),dbModule=require('../lib/db.ts'),originalGetDb=dbModule.getDb,db=new DatabaseSync(':memory:');initializeDatabase(db);dbModule.getDb=()=>db;
  try{
    const {freshProfile}=require('../app/profile-types.ts'),{profileStore}=require('../lib/profile-store.ts'),{MAX_PROFILE_BYTES}=require('../lib/profile-limits.ts');
    const course=JSON.parse(fs.readFileSync('content/story-course/course-v1.json')),library=JSON.parse(fs.readFileSync('content/audio-library/series-v1.json'));
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('all-exercises','789','Learner',at);
    const p=freshProfile();p.journey={active:{},stories:{}};p.audioPractice={};
    for(const raw of course.stories){
      const story={...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([id,node])=>[id,{...node,clips:node.clips.map(ref=>({id:ref.id,...(ref.set==='course'?course:library).segments[ref.id]}))}]))};
      let node=story.start;const route=[node],path=[];while(story.nodes[node].choices.length){path.push(0);node=story.nodes[node].choices[0].next;route.push(node);}
      let state={path,heard:route,assisted:[],finishedAt:at,completedAt:at,endings:[node],updatedAt:at};const exercises=buildStoryExercises(story,path);assert(exercises,'Missing finished-route exercises: '+story.id);
      for(const question of exercises.questions)state=answerExercise(exercises,state,question.id,question.answerIds,at);p.journey.stories[story.id]=state;
    }
    for(const story of library.stories)p.audioPractice[story.id]={completedAt:at,correct:3,total:3,assisted:false};
    p.events=library.stories.map(story=>({id:'audio-library:'+story.id+':00000000-0000-0000-0000-000000000000',at,points:3}));
    p.tests=Array.from({length:50},(_,i)=>{const questionIds=Array.from({length:20},(_,j)=>'question-'+i+'-'+j);return {id:'test-'+i,kind:'control',language:'it',level:'B1',questionIds,finishedAt:at,answers:Object.fromEntries(questionIds.map(id=>[id,{value:'Una risposta di esempio per la verifica. '.repeat(4),correct:true,assisted:false,skill:'reading',checkedAt:at}]))};});
    const bytes=Buffer.byteLength(JSON.stringify(p));assert(bytes<MAX_PROFILE_BYTES,`Complete profile requires ${bytes} bytes; limit is ${MAX_PROFILE_BYTES}`);
    const saved=profileStore().save('all-exercises',{data:p,baseRevision:0,mutationId:'all-exercises-001'});assert.equal(saved.conflict,false);assert.deepEqual(profileStore().get('all-exercises').data,p);
    const first=Object.values(p.journey.stories)[0];first.exercises.routeKey+='9';assert.throws(()=>profileStore().save('all-exercises',{data:p,baseRevision:1,mutationId:'all-exercises-002'}),/Invalid course journey/);
  }finally{dbModule.getDb=originalGetDb;db.close();}
});
