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
