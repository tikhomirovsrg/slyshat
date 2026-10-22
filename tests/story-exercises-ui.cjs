const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {StoryExerciseCard,StoryExercises,moveExerciseOption}=require('../app/story-exercises.tsx');
const {answerExercise}=require('../lib/story-exercise-state.ts');
const {exercisePlaylist}=require('../app/story-playlist.ts');
const at='2026-10-21T12:00:00.000Z';
const question={id:'detail',type:'choice',skill:'comprehension',prompt:'Что произошло в этой реплике?',options:[{id:'a',text:'Дождь начался.'},{id:'b',text:'Дождь закончился.'},{id:'c',text:'Начался снег.'}],answerIds:['a'],explanation:'Объяснение, скрытое до проверки.',evidence:[{nodeId:'end',clipId:'end-line'}]};
const sequence={...question,id:'sequence',type:'sequence',skill:'sequence',prompt:'Расположи реплики в порядке звучания.',answerIds:['b','c','a']};
const set={version:1,releaseId:'story-exercises-v1',storyId:'fixture',routeKey:'story-exercises-v1:fixture:0',questions:[question,{...question,id:'detail-2'},{...question,id:'phrase',skill:'phrase'},sequence]};
const progress=()=>({path:[0],heard:['start','end'],assisted:[],finishedAt:at,updatedAt:at});
const props=()=>({question,index:0,total:4,ready:true,replaying:false,canReplay:true,onAnswer(){},onReplay(){},onNext(){},onPrevious(){}});

test('An unanswered exercise uses labelled radios and does not render the explanation or correctness',()=>{
 const html=renderToStaticMarkup(React.createElement(StoryExerciseCard,props()));
 assert.equal((html.match(/type="radio"/g)||[]).length,3);assert(html.includes('<legend>Что произошло'));
 assert(!html.includes(question.explanation));assert(!html.includes('Верно'));assert(!html.includes('Есть неточность'));assert(!html.includes('К итогу'));
 assert(html.includes('Переслушать фрагмент'));assert(html.includes('Проверить'));
});

test('A checked answer reveals its explanation and locks the submitted options without changing the story',()=>{
 const answer={answerIds:['b'],correct:false,checkedAt:at,assisted:false};
 const html=renderToStaticMarkup(React.createElement(StoryExerciseCard,{...props(),answer}));
 assert(html.includes(question.explanation));assert(html.includes('Есть неточность'));assert(html.includes('<b>Ответ:</b>'));assert(html.includes('<fieldset disabled=""'));
 assert(!html.includes('>Проверить'));assert(html.includes('Дальше'));
});

test('Sequence questions have keyboard buttons in both directions and no drag-only interaction',()=>{
 const html=renderToStaticMarkup(React.createElement(StoryExerciseCard,{...props(),question:sequence}));
 assert.equal((html.match(/aria-label="Переместить реплику/g)||[]).length,6);
 assert(html.includes('Переместить реплику 1 выше'));assert(html.includes('Переместить реплику 3 ниже'));
 assert(html.includes('aria-live="polite"'));assert(!html.includes('draggable='));assert(!html.includes(sequence.explanation));
 const original=['a','b','c'];assert.deepEqual(moveExerciseOption(original,1,-1),['b','a','c']);assert.deepEqual(original,['a','b','c']);
 assert.deepEqual(moveExerciseOption(original,1,1),['a','c','b']);assert.deepEqual(moveExerciseOption(original,0,-1),original);assert.deepEqual(moveExerciseOption(original,2,1),original);
});

test('The result shows only this route, supports reviewing and retrying, and discloses assistance',()=>{
 let p={...progress(),assisted:['start']};for(const q of set.questions)p=answerExercise(set,p,q.id,q.answerIds,at);
 const draw=state=>renderToStaticMarkup(React.createElement(StoryExercises,{exercises:set,progress:state,ready:true,playingQuestionId:null,evidenceAvailable:{},onAnswer(){},onReplay(){},onStopReplay(){},onRestart(){}}));
 const completed=draw(p);assert(completed.includes('Верно: 4 из 4'));assert(completed.includes('Повторить задания'));assert(completed.includes('Посмотреть разбор'));assert(completed.includes('Результат с дополнительной помощью'));
 const stale=draw({...p,exercises:{...p.exercises,routeKey:'story-exercises-v1:fixture:1'}});assert(!stale.includes('Верно: 4 из 4'));assert(stale.includes('Задание 1 из 4'));assert(!stale.includes(question.explanation));
});

test('Evidence audio cannot include unvisited branches, even when a reference asks for them',()=>{
 const clip=id=>({id,text:id,ru:id,voice:'fixture',source:'/audio/'+id+'.mp3',startAt:0,endAt:1});
 const story={start:'start',nodes:{start:{clips:[clip('start-line')],choices:[{next:'left'},{next:'right'}]},left:{clips:[clip('left-line')],choices:[]},right:{clips:[clip('secret-ending')],choices:[]}}};
 const audio=exercisePlaylist(story,[0],[{nodeId:'right',clipId:'secret-ending'},{nodeId:'left',clipId:'left-line'},{nodeId:'start',clipId:'start-line'}]);
 assert.deepEqual(audio.map(entry=>entry.clip.id),['start-line','left-line']);
});

test('Post-story questions stay hidden until the finished route has a fully heard final scene',()=>{
 const {ComicStory}=require('../app/story-course.tsx'),{buildStoryExercises}=require('../lib/story-exercises.mjs');
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/story-course/course-v1.json'))),base=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/audio-library/series-v1.json')));
 const raw=source.stories.find(story=>!story.legacy),story={...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([id,node])=>[id,{...node,clips:node.clips.map(ref=>({id:ref.id,...(ref.set==='course'?source:base).segments[ref.id],source:'/audio/course/test.mp3',startAt:0,endAt:10}))}]))};
 const route=[story.start],choices=[];while(story.nodes[route.at(-1)].choices.length){choices.push(0);route.push(story.nodes[route.at(-1)].choices[0].next);}
 const exercises=buildStoryExercises(story,choices);assert(exercises&&exercises.questions.length>=3);
 const draw=p=>renderToStaticMarkup(React.createElement(ComicStory,{story,profile:{data:{journey:{active:{},stories:{[story.id]:p}},events:[]},ready:true,status:'synced',conflict:false,update(){}},speed:1,onSpeed(){},next:null,onNext(){},onClose(){}}));
 const p={...progress(),path:choices,heard:route.slice(0,-1),assisted:[]};
 const locked=draw(p);assert(locked.includes('Слушать финальную сцену'));assert(!locked.includes(exercises.questions[0].prompt));
 const open=draw({...p,heard:route});assert(open.includes(exercises.questions[0].prompt));assert(open.includes('Задание 1 из 4'));
 const unfinished=draw({...p,heard:route,finishedAt:null});assert(!unfinished.includes(exercises.questions[0].prompt));
 // A final scene with no recording must not trap an already completed story
 // behind an impossible listening action. Questions retain reading assistance.
 for(const clip of story.nodes[route.at(-1)].clips)clip.source='';
 const fallback=draw({...p,assisted:[route.at(-1)]});
 assert(fallback.includes(exercises.questions[0].prompt));assert(!fallback.includes('Слушать финальную сцену'));
});
