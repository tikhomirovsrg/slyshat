const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {StorySpeakingPractice,storySpeakingChoice}=require('../app/story-speaking-practice.tsx');
const clip=id=>({id,text:'Recorded '+id,ru:'Перевод '+id,voice:'test',source:'/audio/'+id+'.mp3',startAt:2,endAt:5});
const choice=(id,next)=>({text:'My answer '+id,label:'Русская подсказка '+id,next,clip:clip(id)});
const story={id:'speaking-story',language:'en',level:'A1',position:1,title:'Test',topic:'Test',summary:'Summary',context:'Context',art:'coffee',legacy:false,start:'start',origin:'test',nodes:{
 start:{clips:[],choices:[choice('left','left'),choice('right','right')]},
 left:{clips:[],choices:[choice('left-end','end')]},
 right:{clips:[],choices:[choice('unchosen','end'),choice('chosen-end','end')]},
 end:{clips:[],choices:[]},
}};
const props=()=>({story,path:[1,1],ready:true,listening:false,onListen(){},onStop(){}});
function withReveal(revealed,run){
 const original=React.useState;
 React.useState=initial=>{const pair=original(initial);return [revealed,pair[1]];};
 try{return run();}finally{React.useState=original;}
}
const draw=(values,revealed=false)=>withReveal(revealed,()=>renderToStaticMarkup(React.createElement(StorySpeakingPractice,values)));
function buttons(values,revealed){
 const originalState=React.useState,originalId=React.useId;
 React.useState=()=>[revealed,()=>{}];React.useId=()=>':test:';
 try{
  const wrapper=StorySpeakingPractice(values),tree=wrapper.type(wrapper.props),found=[];
  function visit(value){if(!React.isValidElement(value))return;if(value.type==='button')found.push(value);React.Children.forEach(value.props.children,visit);}
  visit(tree);return found;
 }finally{React.useState=originalState;React.useId=originalId;}
}

test('The prompt uses the last selected answer and preserves its original playback coordinates',()=>{
 const target=storySpeakingChoice(story,[1,1]);
 assert.equal(target.text,story.nodes.right.choices[1].text);assert.equal(target.label,story.nodes.right.choices[1].label);
 assert.deepEqual(target.entry,{clip:story.nodes.right.choices[1].clip,nodeId:'right',kind:'choice',clipIndex:0,choiceIndex:1});
 assert.equal(storySpeakingChoice(story,[1]).text,story.nodes.start.choices[1].text);
 assert.equal(storySpeakingChoice(story,[]),null);assert.equal(storySpeakingChoice(story,[9]),null);
 const missing=structuredClone(story);missing.nodes.right.choices[1].label='   ';
 assert.equal(storySpeakingChoice(missing,[1,1]).text,story.nodes.start.choices[1].text);
});

test('The first view gives a Russian recall cue without exposing any target answer or audio button',()=>{
 const html=draw(props());
 assert(html.includes(story.nodes.right.choices[1].label));assert(html.includes('Перескажи в 2–3 предложениях'));
 for(const node of Object.values(story.nodes))for(const option of node.choices)assert(!html.includes(option.text));
 assert(!html.includes(story.nodes.right.choices[0].label));assert(!html.includes('Послушать образец'));
 assert(html.includes('aria-expanded="false"'));assert(html.includes('Сравнить с ответом героя'));
 assert.equal(draw({...props(),ready:false}),'');
});

test('Only an opened recorded sample can play, and it uses the shared playback callbacks',()=>{
 const played=[],values={...props(),onListen:entry=>played.push(entry)},html=draw(values,true);
 assert(html.includes('<p lang="en">'+story.nodes.right.choices[1].text));assert(html.includes('Теперь измени одну деталь и скажи по-своему.'));
 assert(!html.includes(story.nodes.right.choices[0].text));assert(html.includes('aria-expanded="true"'));
 const playButton=buttons(values,true).find(button=>button.props.children==='Послушать образец');
 assert(playButton);playButton.props.onClick();assert.deepEqual(played,[storySpeakingChoice(story,[1,1]).entry]);
 assert(!buttons(values,false).some(button=>button.props.children==='Послушать образец'));
 let stopped=0;const active={...values,listening:true,onStop:()=>stopped++};
 buttons(active,true).find(button=>button.props.children==='Остановить образец').props.onClick();
 buttons(active,true).find(button=>button.props.children==='Скрыть образец').props.onClick();
 assert.equal(stopped,2);assert.equal(played.length,1);
});

test('An unrecorded last selected answer still has a text sample without borrowing another voice clip',()=>{
 const missing=structuredClone(story);delete missing.nodes.right.choices[1].clip;
 const target=storySpeakingChoice(missing,[1,1]),html=draw({...props(),story:missing},true);
 assert.equal(target.nodeId,'right');assert.equal(target.choiceIndex,1);assert.equal(target.entry,null);
 assert(html.includes(missing.nodes.right.choices[1].text));assert(!html.includes('Послушать образец'));
 missing.nodes.right.choices[1].clip={...clip('empty'),source:''};assert.equal(storySpeakingChoice(missing,[1,1]).entry,null);
});

test('Changing story or route remounts the prompt so revealed samples cannot survive navigation',()=>{
 const current=StorySpeakingPractice(props());
 assert.equal(current.key,StorySpeakingPractice({...props(),path:[1,1]}).key);
 assert.notEqual(current.key,StorySpeakingPractice({...props(),path:[0,0]}).key);
 assert.notEqual(current.key,StorySpeakingPractice({...props(),story:{...story,id:'another-story'}}).key);
 assert(!draw({...props(),path:[0,0]}).includes(story.nodes.left.choices[0].text));
});
