const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {ComicStory}=require('../app/story-course.tsx');
const {storyReadingKey,emptyStoryReading,currentStoryReading,toggleStoryReading,toggleChoiceReading}=require('../app/story-reading-state.ts');
const clip=id=>({id,text:'Hidden dialogue '+id,ru:'Скрытый перевод сцены '+id,voice:'test',source:'/audio/'+id+'.mp3',startAt:0,endAt:2});
const choice=(id,next)=>({text:'Hidden answer '+id,label:'Скрытый перевод ответа '+id,next,clip:clip('answer-'+id)});
const story={id:'reading-story',language:'en',level:'A1',position:1,title:'Reading test',topic:'Test',summary:'Summary',context:'Context',art:'coffee',legacy:false,start:'start',origin:'test',nodes:{
 start:{clips:[clip('start')],choices:[choice('left','left'),choice('right','right')]},
 left:{clips:[clip('left')],choices:[choice('left-end','end')]},
 right:{clips:[clip('right')],choices:[choice('right-end','end')]},
 end:{clips:[clip('end')],choices:[]},
}};
function opened(key){return toggleChoiceReading(toggleStoryReading(toggleStoryReading(emptyStoryReading(key),key,'revealed'),key,'translation'),key,0);}
function renderWithReading(value,path,reading){
 const profile={ready:true,conflict:false,status:'synced',update(){},data:{events:[],journey:{active:{en:value.id},stories:{[value.id]:{path,heard:Object.keys(value.nodes),assisted:[],finishedAt:null,updatedAt:'2026-10-21'}}}}};
 const original=React.useState;
 // Keep the previous render's reading state, as React does before passive
 // effects run when a synced profile replaces the route.
 React.useState=initial=>{const pair=original(initial);return pair[0]?.key&&Array.isArray(pair[0].choiceTexts)?[reading,pair[1]]:pair;};
 try{return renderToStaticMarkup(React.createElement(ComicStory,{story:value,profile,speed:1,onSpeed(){},next:null,onNext(){},onClose(){}}));}
 finally{React.useState=original;}
}
function hidden(html,node){for(const value of [...node.clips.flatMap(c=>[c.text,c.ru]),...node.choices.flatMap(c=>[c.text,c.label])])assert(!html.includes(value),value);}

test('A synced route or story change hides stale reading flags in the first render',()=>{
 const prior=opened(storyReadingKey(story.id,'left'));
 const old=renderWithReading(story,[0],prior);assert(old.includes(story.nodes.left.clips[0].text));assert(old.includes(story.nodes.left.choices[0].label));
 hidden(renderWithReading(story,[1],prior),story.nodes.right);
 hidden(renderWithReading({...story,id:'another-story'},[0],prior),story.nodes.left);
});

test('Opening help after a route change affects only the current scene',()=>{
 const before=storyReadingKey(story.id,'left'),after=storyReadingKey(story.id,'right'),prior=opened(before),snapshot=structuredClone(prior);
 const current=toggleStoryReading(prior,after,'translation');
 assert.deepEqual(current,{key:after,revealed:false,translation:true,choiceTexts:[]});
 assert.deepEqual(currentStoryReading(current,before),emptyStoryReading(before));assert.deepEqual(prior,snapshot);
});

test('Restart clears all reading help even when replay stays on the first node',()=>{
 const key=storyReadingKey(story.id,story.start),prior=opened(key);
 assert(renderWithReading(story,[],prior).includes(story.nodes.start.clips[0].text));
 hidden(renderWithReading(story,[],emptyStoryReading(key)),story.nodes.start);
});


test('Missing scene recordings reveal only their own text and never offer an empty scene player',()=>{
 const silent=structuredClone(story);silent.nodes.start.clips[0].source='';delete silent.nodes.start.choices[0].clip;
 const key=storyReadingKey(silent.id,silent.start),reading=emptyStoryReading(key);
 const html=renderWithReading(silent,[],reading);
 assert(html.includes(silent.nodes.start.clips[0].text));assert(html.includes(silent.nodes.start.choices[0].text));
 assert(!html.includes(silent.nodes.start.choices[1].text));assert(!html.includes(silent.nodes.start.clips[0].ru));
 assert(!html.includes('Открыть текст'));assert(!html.includes('Слушать сцену'));assert(!html.includes('Показать текст A'));assert(html.includes('Показать текст B'));
 const mixed=structuredClone(silent);mixed.nodes.start.clips.push(clip('recorded-line'));
 const partial=renderWithReading(mixed,[],reading);
 assert(partial.includes(mixed.nodes.start.clips[0].text));assert(!partial.includes(mixed.nodes.start.clips[1].text));assert(partial.includes('Открыть текст'));assert(partial.includes('Слушать сцену'));
});

// Invoke the actual component callbacks with an in-memory profile, without
// effects, to cover a click before the automatic assistance effect has run.
function storyControls(value,progress,options={}){
 const hooks=Object.fromEntries(['useState','useRef','useMemo','useEffect'].map(name=>[name,React[name]]));
 const speech=require('../app/speech.tsx'),originalPlayer=speech.useSpeechPlayer;
 const profile={ready:true,conflict:false,...options,data:{events:[],journey:{active:{},stories:{[value.id]:progress}}},update(fn){this.data=fn(this.data);}};
 React.useState=initial=>[typeof initial==='function'?initial():initial,()=>{}];React.useRef=current=>({current});React.useMemo=fn=>fn();React.useEffect=()=>{};
 const played=[];speech.useSpeechPlayer=()=>({play:async(id,clip)=>{played.push(clip.source);return options.complete!==false;},stop(){},setPlaybackSpeed(){},error:'',state:null});
 let tree;
 try{tree=ComicStory({story:value,profile,speed:1,onSpeed(){},next:null,onNext(){},onClose(){}});}
 finally{Object.assign(React,hooks);speech.useSpeechPlayer=originalPlayer;}
 const elements=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;elements.push(node);walk(node.props?.children);}walk(tree);
 const label=node=>typeof node==='string'?node:Array.isArray(node)?node.map(label).join(''):node?.props?label(node.props.children):'';
 return {profile,played,choices:elements.find(node=>node.type===require('../app/character-cast.tsx').StoryChoices)?.props,button:text=>elements.find(node=>node.type==='button'&&label(node).includes(text))?.props};
}
const freshProgress=()=>({path:[],heard:[],assisted:[],finishedAt:null,updatedAt:'2026-10-21T12:00:00.000Z'});

test('The story handler selects an unrecorded answer directly, retaining the scene and profile gates',()=>{
 const value=structuredClone(story);delete value.nodes.start.choices[0].clip;
 const p={...freshProgress(),heard:['start']},active=storyControls(value,p);active.choices.onChoose(0);
 const saved=active.profile.data.journey.stories[value.id];assert.deepEqual(saved.path,[0]);assert.deepEqual(saved.assisted,['start']);assert.deepEqual(saved.heard,['start']);
 for(const [progress,options] of [[freshProgress(),{}],[p,{ready:false}],[p,{conflict:true}]]){
  const locked=storyControls(value,progress,options);locked.choices.onChoose(0);assert.deepEqual(locked.profile.data.journey.stories[value.id].path,[]);
 }
 // Reading the automatically shown alternative is assistance even if a
 // recorded answer is chosen instead.
 const other=storyControls(value,p);other.choices.onChoose(1);assert.deepEqual(other.profile.data.journey.stories[value.id].assisted,['start']);
});

test('A silent scene and ending remain passable without claiming any listening credit',()=>{
 const value=structuredClone(story);for(const node of Object.values(value.nodes))for(const c of node.clips)c.source='';
 const active=storyControls(value,freshProgress());assert.equal(active.choices.canAdvance,true);active.choices.onChoose(0);
 const saved=active.profile.data.journey.stories[value.id];assert.deepEqual(saved.path,[0]);assert.deepEqual(saved.heard,[]);assert.deepEqual(saved.assisted,['start']);
 const end=storyControls(value,{...freshProgress(),path:[0,0]});end.button('Завершить историю').onClick();
 const completed=end.profile.data.journey.stories[value.id];assert(completed.finishedAt);assert.deepEqual(completed.heard,[]);assert.deepEqual(completed.assisted,['end']);
});

test('Playing a partial scene credits reading, while only complete recorded playback credits listening',async()=>{
 const mixed=structuredClone(story);mixed.nodes.start.clips.unshift({...clip('missing'),source:''});
 for(const [value,options,heard,assisted] of [[mixed,{},[],['start']],[story,{},['start'],[]],[mixed,{complete:false},[],[]]]){
  const active=storyControls(value,freshProgress(),options);active.button('Слушать сцену').onClick();
  await new Promise(resolve=>setImmediate(resolve));
  const saved=active.profile.data.journey.stories[value.id];assert.deepEqual(saved.heard,heard);assert.deepEqual(saved.assisted,assisted);assert.deepEqual(active.played,['/audio/start.mp3']);
 }
});
