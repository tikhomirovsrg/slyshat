const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {StoryCourse,ComicStory,CourseProgress,savedArchivedStories,unfinishedArchivedStory}=require('../app/story-course.tsx');
const {StudyDashboard}=require('../app/study-dashboard.tsx');
const {freshProfile}=require('../app/profile-types.ts');
const {STORY_EXERCISES_RELEASE_ID:release}=require('../lib/story-exercises.mjs');
const at='2026-10-20T12:00:00.000Z';
const card=(id,archived=false)=>({id,archived,position:archived?999:1,language:'en',level:'A2',title:'Title '+id,topic:'Topic',summary:'Summary',art:'coffee',legacy:false});
const progress=(finished=false)=>({path:[],heard:['start'],assisted:[],finishedAt:finished?at:null,updatedAt:at});
const profile=journey=>({ready:true,conflict:false,status:'synced',data:{...freshProfile(),journey},update(){},refresh(){},resolve(){},event(){}});
function renderWithState(component,props,overrides){
 const original=React.useState;let index=0;
 React.useState=initial=>{const result=original(initial),position=index++;return Object.hasOwn(overrides,position)?[overrides[position],result[1]]:result;};
 try{return renderToStaticMarkup(React.createElement(component,props));}finally{React.useState=original;}
}
const active=card('current'),old=card('old-current',true),done=card('old-done',true),legacy=card('legacy-started',true),unseen=card('never-opened',true);
const catalog={items:[active],archived:[old,done,legacy,unseen],total:1,counts:{A1:0,A2:1,B1:0,B2:0,C1:0},provenance:'Curated'};

test('Only saved archive IDs remain visible and an unfinished archived route resumes under its original ID',()=>{
 const journey={active:{en:old.id},stories:{[old.id]:{...progress(),completedAt:at},[done.id]:progress(true)}},book={[legacy.id]:{started:true},[unseen.id]:{started:false}};
 const snapshot=structuredClone(journey),saved=savedArchivedStories(catalog.archived,journey,book);
 assert.deepEqual(saved.map(item=>item.id),[old.id,done.id,legacy.id]);
 assert.equal(unfinishedArchivedStory(saved,'en',journey,book).id,old.id);
 assert.equal(unfinishedArchivedStory(saved,'it',journey,book),null);
 journey.stories[old.id].finishedAt=at;assert.equal(unfinishedArchivedStory(saved,'en',journey,book),null);
 journey.stories[old.id].finishedAt=null;assert.deepEqual(journey,snapshot);
});

test('The catalog separates saved archive entries from active cards and shows honest empty-level counts',()=>{
 const journey={active:{en:old.id},stories:{[old.id]:progress()}},props={language:'en',profile:profile(journey),book:{},speed:1,onSpeed(){},onLanguage(){}};
 const html=renderWithState(StoryCourse,props,{0:catalog});
 assert(html.includes(active.title));assert(html.includes(old.title));assert(!html.includes(unseen.title));assert(!html.includes(done.title));
 assert(html.includes('Ранее начатые истории · 1'));assert(html.includes('Продолжить сохранённую историю'));
 assert(html.includes('A1 · 0'));assert(!html.includes('по 200'));assert(!html.includes('980 интерактивных'));
 const empty=renderWithState(StoryCourse,props,{0:catalog,5:'A1'});
 assert(empty.includes('В каталоге пока нет историй этого уровня.'));assert(empty.includes('<div class="comic-grid"></div>'));
});

test('Archived story view hides its historical number and offers the catalog instead of a next-story transition',()=>{
 const story={...old,context:'Context',origin:'Source',start:'start',nodes:{start:{clips:[{id:'line',text:'Line',ru:'Реплика',voice:'test',source:'/audio/test.mp3',startAt:0,endAt:1}],choices:[],outcome:{title:'Ending',body:'Done'}}}};
 const html=renderToStaticMarkup(React.createElement(ComicStory,{story,profile:profile({active:{en:old.id},stories:{[old.id]:progress(true)}}),speed:1,onSpeed(){},next:active,onNext(){},onClose(){}}));
 assert(html.includes('История из архива.'));assert(!html.includes('#999'));assert(!html.includes('Следующая история'));assert(html.includes('Ко всем историям'));
});

test('Dashboard retains saved archived exercise results without recommending archived or unseen stories',()=>{
 const ids=['opening-fact','route-detail','phrase-meaning','route-sequence'],p=progress(true);
 p.exercises={version:release,routeKey:`${release}:${done.id}:`,answers:Object.fromEntries(ids.map((id,index)=>[id,{answerIds:index===3?['o0','o1','o2']:['o0'],correct:index!==0,assisted:false,checkedAt:at}])),assisted:false,replayed:false,updatedAt:at,completedAt:at};
 const html=renderWithState(StudyDashboard,{language:'en',profile:profile({active:{en:done.id},stories:{[done.id]:p}}),book:{},onSelect(){}},{1:[active],2:[done,unseen],3:'ready'});
 assert(html.includes('<b>3/4</b>'));assert(html.includes(active.title));assert(!html.includes(done.title));assert(!html.includes(unseen.title));assert(!html.includes('Вернуться и закрепить'));
});

test('Course progress counts active stories separately from retained archived completions, even with an empty catalog',()=>{
 const journey={active:{en:done.id},stories:{[done.id]:progress(true)}};
 const html=renderWithState(CourseProgress,{profile:profile(journey),book:{}},{0:[{...catalog,language:'en',items:[],total:0,counts:{A1:0,A2:0,B1:0,B2:0,C1:0}}]});
 assert(html.includes('0 / 0'));assert(html.includes('Ранее начатые: 1. Финал открыт: 1.'));
});
