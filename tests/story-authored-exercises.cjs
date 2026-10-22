const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildStoryExercises,gradeStoryExercise}=require('../lib/story-exercises.mjs');
function fixture(){
 const line=(id,text,ru)=>({id,text,ru});
 const question=(nodeId,clipId,sourceText,options)=>({nodeId,clipId,sourceText,prompt:'Что произошло?',options,answer:0,explanation:'Ответ следует из прослушанной реплики.'});
 const story={id:'new-en-a1-fixture',start:'start',nodes:{
  start:{clips:[line('start-line','The red box is empty.','Красная коробка пуста.')],choices:[{text:'Open the blue box.',label:'Открыть синюю.',next:'a'},{text:'Ask Sam.',label:'Спросить Сэма.',next:'b'}]},
  a:{clips:[line('a-line','The blue box has a cake.','В синей коробке торт.')],choices:[{text:'Share it.',label:'Поделиться.',next:'end-a'}]},
  b:{clips:[line('b-line','Sam has the cake in his bag.','Торт у Сэма в сумке.')],choices:[{text:'Call him.',label:'Позвать его.',next:'end-b'}]},
  'end-a':{clips:[line('end-a-line','We eat the cake at home.','Мы едим торт дома.')],choices:[]},
  'end-b':{clips:[line('end-b-line','Sam brings the cake to the park.','Сэм приносит торт в парк.')],choices:[]}
 }};
 story.authoredExercises={
  opening:question('start','start-line','The red box is empty.',['Красная коробка пуста.','Красная коробка закрыта.','Красная коробка у Сэма.']),
  phrase:{...question('start','start-line','The red box is empty.',['В ней ничего нет.','Она открыта.','Она маленькая.']),anchor:'empty'},
  branches:{a:question('a','a-line','The blue box has a cake.',['Торт в синей коробке.','Торт в красной коробке.','Торт в сумке.']),b:question('b','b-line','Sam has the cake in his bag.',['Торт в сумке Сэма.','Торт уже съели.','Торт в синей коробке.'])}
 };
 return story;
}
test('Authored exercises follow the heard branch and retain stable grades',()=>{
 const story=fixture(),before=JSON.stringify(story);
 for(const [path,branch] of [[[0,0],'a'],[[1,0],'b']]){
  const set=buildStoryExercises(story,path);assert.equal(set.releaseId,'story-exercises-v2');assert.equal(set.version,2);assert.equal(set.questions.length,4);
  const detail=set.questions.find(q=>q.id==='route-detail');assert.equal(detail.evidence[0].nodeId,branch);
  assert(set.questions.every(q=>q.evidence.every(ref=>ref.nodeId!== (branch==='a'?'b':'a'))));
  for(const question of set.questions){assert(gradeStoryExercise(question,question.answerIds));assert(!gradeStoryExercise(question,[]));}
  assert.deepEqual(buildStoryExercises(story,path),set);
 }
 assert.equal(JSON.stringify(story),before);
});
test('Authored questions fail closed after evidence changes or points into an unseen branch',()=>{
 const changed=fixture();changed.nodes.a.clips[0].text='The blue box has a book.';assert.equal(buildStoryExercises(changed,[0,0]),null);assert(buildStoryExercises(changed,[1,0]));
 const leaked=fixture();leaked.authoredExercises.branches.a=leaked.authoredExercises.branches.b;assert.equal(buildStoryExercises(leaked,[0,0]),null);
 const absent=fixture();absent.authoredExercises.phrase.anchor='full';assert.equal(buildStoryExercises(absent,[0,0]),null);
 assert.equal(buildStoryExercises(fixture(),[0]),null);
});
