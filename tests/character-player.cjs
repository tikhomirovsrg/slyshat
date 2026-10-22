const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {routePlaylist,scenePlaylist,exercisePlaylist,playStoryPlaylist}=require('../app/story-playlist.ts');
const {StoryChoices,characterName}=require('../app/character-cast.tsx');
const clip=id=>({id,text:'Spoken '+id,ru:'Перевод '+id,voice:'arbitrary-voice',actorId:'traveler',actorName:'Майя',source:'/audio/'+id+'.mp3',startAt:0,endAt:2});
const choice=(id,next,recorded=true)=>({text:'Secret answer '+id,label:'Скрытый перевод '+id,next,...(recorded?{clip:clip(id)}:{})});
function fixture(){return {id:'test-story',start:'start',nodes:{
 start:{clips:[clip('intro-1'),clip('intro-2')],choices:[choice('choice-A','left'),choice('choice-B','right')]},
 left:{clips:[clip('left-line')],choices:[choice('choice-left','left-end')]},
 right:{clips:[clip('right-line')],choices:[choice('choice-right','right-end',false)]},
 'left-end':{clips:[clip('left-ending')],choices:[]},'right-end':{clips:[clip('right-ending')],choices:[]},
 }};}

test('Full dialogue follows only the selected route, interleaving scene clips and selected recorded answers',()=>{
 const story=fixture(),snapshot=structuredClone(story);
 assert.deepEqual(routePlaylist(story,[0,0]).map(entry=>entry.clip.id),['intro-1','intro-2','choice-A','left-line','choice-left','left-ending']);
 assert.deepEqual(routePlaylist(story,[1,0]).map(entry=>entry.clip.id),['intro-1','intro-2','choice-B','right-line','right-ending']);
 assert.deepEqual(routePlaylist(story,[]).map(entry=>entry.clip.id),['intro-1','intro-2']);
 assert.equal(routePlaylist(story,[0])[2].kind,'choice');assert.equal(routePlaylist(story,[0])[2].choiceIndex,0);
 assert.deepEqual(story,snapshot);assert.throws(()=>routePlaylist(story,[9]),/Invalid story path/);
});

test('Real English and Italian variants play each selected answer once while retaining scene and exercise recordings',()=>{
 const course=require('../content/story-course/course-v1.json'),library=require('../content/audio-library/series-v1.json'),cast=require('../content/characters/cast-v1.json');
 const {characterForVoice}=require('../lib/character-cast.mjs');
 for(const language of ['en','it']){
  const raw=course.stories.find(story=>story.id===`story-${language}-a1-dinner-time`),assignment=cast.stories[raw.id],player=assignment.cast.find(actor=>actor.actorId===assignment.playerActorId),cues=new Map();
  const recorded=(id,text,ru,actor)=>{
   const key=actor.actorId+'\0'+text;if(!cues.has(key))cues.set(key,cues.size*3);
   return {id,text,ru,actorId:actor.actorId,voice:cast.voiceProfiles[actor.voiceProfileId].voice,source:`/audio/${actor.voiceProfileId}.mp3`,startAt:cues.get(key),endAt:cues.get(key)+2};
  };
  const story={...raw,nodes:Object.fromEntries(Object.entries(raw.nodes).map(([nodeId,node])=>[nodeId,{...node,
   clips:node.clips.map(ref=>{const source=(ref.set==='course'?course.segments:library.segments)[ref.id];return recorded(ref.id,source.text,source.ru,characterForVoice(assignment,source.voice));}),
   choices:node.choices.map((choice,index)=>({...choice,clip:recorded(`${raw.id}:${nodeId}:choice:${index}`,choice.text,choice.label,player)})),
  }]))},snapshot=structuredClone(story);
  const path=[0,0],answer=story.nodes.start.choices[0].clip,echo=story.nodes.a.clips[0];
  assert.notEqual(answer.id,echo.id);assert.equal(answer.actorId,echo.actorId);assert.equal(answer.text,echo.text);assert.equal(answer.startAt,echo.startAt);
  const full=routePlaylist(story,path);assert.equal(full.length,6);assert.equal(full.filter(entry=>entry.kind==='choice').length,2);
  assert.equal(full.filter(entry=>entry.clip.text===answer.text).length,1);
  assert(full.filter(entry=>entry.nodeId==='a'&&entry.kind==='scene').every(entry=>entry.clipIndex===1));
  assert.deepEqual(scenePlaylist(story,'a').map(entry=>entry.clip.id),story.nodes.a.clips.map(clip=>clip.id));
  const evidence=['a','a-message'].map(nodeId=>({nodeId,clipId:story.nodes[nodeId].clips[0].id}));
  assert.deepEqual(exercisePlaylist(story,path,evidence).map(entry=>({nodeId:entry.nodeId,clipId:entry.clip.id})),evidence);
  assert.deepEqual(story,snapshot);
 }
});

test('Boundary deduplication requires the same explicit actor and words and leaves other repetitions intact',()=>{
 const make=(change={})=>{const story=fixture(),answer=story.nodes.start.choices[0].clip;story.nodes.left.clips=[{...answer,id:'answer-echo',...change}];return story;};
 const ids=story=>routePlaylist(story,[0]).map(entry=>entry.clip.id);
 assert(!ids(make()).includes('answer-echo'));
 assert(!ids(make({source:'/audio/another-recording.mp3',startAt:4,endAt:6})).includes('answer-echo'));
 assert(ids(make({actorId:'another-speaker'})).includes('answer-echo'));
 assert(ids(make({text:'A different answer'})).includes('answer-echo'));
 const unknown=make();delete unknown.nodes.start.choices[0].clip.actorId;delete unknown.nodes.left.clips[0].actorId;
 assert(ids(unknown).includes('answer-echo'));
 const unavailable=make();delete unavailable.nodes.start.choices[0].clip;
 assert(ids(unavailable).includes('answer-echo'));
 const later=make();later.nodes.left.clips.unshift(clip('scene-introduction'));
 assert(ids(later).includes('answer-echo'));
 const repeated=make();repeated.nodes.left.clips.push({...repeated.nodes.left.clips[0],id:'intentional-repeat'});
 assert(!ids(repeated).includes('answer-echo'));assert(ids(repeated).includes('intentional-repeat'));
});

test('A sequence takes the current speed for every new clip and reports completion only after all entries',async()=>{
 const entries=routePlaylist(fixture(),[0,0]),played=[],seen=[];let speed=.75;
 const complete=await playStoryPlaylist(entries,{isCurrent:()=>true,getSpeed:()=>speed,onEntry:(entry,index)=>seen.push([entry.clip.id,index]),play:async(entry,rate)=>{played.push([entry.clip.id,rate]);speed=1.25;return true;}});
 assert(complete);assert.deepEqual(played.map(([id])=>id),entries.map(entry=>entry.clip.id));assert.equal(played[0][1],.75);assert(played.slice(1).every(([,rate])=>rate===1.25));assert.equal(seen.length,entries.length);
 assert.equal(await playStoryPlaylist([],{isCurrent:()=>true,getSpeed:()=>1,onEntry(){throw Error('no entry');},play(){throw Error('no clip');}}),false);
});

test('Cancellation or an interrupted clip never starts the next clip, including cancellation as a clip ends',async()=>{
 const entries=scenePlaylist(fixture(),'start');let current=true,release;const played=[];
 const pending=playStoryPlaylist(entries,{isCurrent:()=>current,getSpeed:()=>1,onEntry(){},play:entry=>{played.push(entry.clip.id);return new Promise(resolve=>release=resolve);}});
 assert.deepEqual(played,['intro-1']);current=false;release(true);assert.equal(await pending,false);assert.deepEqual(played,['intro-1']);
 const failed=[];assert.equal(await playStoryPlaylist(entries,{isCurrent:()=>true,getSpeed:()=>1,onEntry(){},play:async entry=>{failed.push(entry.clip.id);return false;}}),false);assert.deepEqual(failed,['intro-1']);
});

const choiceProps=()=>({choices:fixture().nodes.start.choices,language:'en',ready:true,canAdvance:true,textOpen:[],translationOpen:false,playingChoice:null,onListen(){},onChoose(){},onReveal(){}});
function choiceButtons(props){
 const buttons=[];
 function label(value){if(Array.isArray(value))return value.map(label).join('');return typeof value==='string'?value:value?.props?label(value.props.children):'';}
 function walk(value){if(Array.isArray(value))return value.forEach(walk);if(!value||typeof value!=='object')return;if(value.type==='button')buttons.push({label:label(value.props.children),...value.props});walk(value.props?.children);}
 walk(StoryChoices(props));return buttons;
}
test('Recorded choices hide target text and translation from the entire initial markup, with independent listen and select controls',()=>{
 const props=choiceProps(),draw=extra=>renderToStaticMarkup(React.createElement(StoryChoices,{...props,...extra})),html=draw({});
 for(const value of props.choices.flatMap(c=>[c.text,c.label]))assert(!html.includes(value));
 assert(html.includes('Слушать A'));assert(html.includes('Выбрать A'));assert(!html.includes('title='));
 const text=draw({textOpen:[0]});assert(text.includes(props.choices[0].text));assert(!text.includes(props.choices[0].label));assert(!text.includes(props.choices[1].text));
 const translation=draw({translationOpen:true});for(const c of props.choices){assert(translation.includes(c.label));assert(!translation.includes(c.text));}
 assert(choiceButtons(props).every(button=>!button.label.toLowerCase().includes('перевод')));
 const disabled=choiceButtons({...props,canAdvance:false});assert(disabled.length>0);assert(disabled.every(button=>button.disabled));
 const stale=draw({canAdvance:false,textOpen:[0,1],translationOpen:true});for(const value of props.choices.flatMap(c=>[c.text,c.label]))assert(!stale.includes(value));
});

test('Listening to an answer calls no selection handler; selecting is a separate action',()=>{
 const calls=[],props=choiceProps();props.onListen=index=>calls.push(['listen',index]);props.onChoose=index=>calls.push(['choose',index]);props.onReveal=index=>calls.push(['read',index]);
 const buttons=choiceButtons(props);
 buttons.find(button=>button.label.includes('Слушать A')).onClick();assert.deepEqual(calls,[['listen',0]]);
 buttons.find(button=>button.label.includes('Выбрать A')).onClick();assert.deepEqual(calls,[['listen',0],['choose',0]]);
 buttons.find(button=>button.label==='Показать текст B').onClick();assert.deepEqual(calls.at(-1),['read',1]);
});

test('Unavailable answer audio shows text immediately and allows selection without revealing it',()=>{
 for(const missingClip of [undefined,{...clip('fallback'),source:''}]){
  const calls=[],props={...choiceProps(),choices:[{...choice('fallback','end',false),clip:missingClip}],onChoose:index=>calls.push(['choose',index]),onReveal:index=>calls.push(['reveal',index])};
  const draw=extra=>renderToStaticMarkup(React.createElement(StoryChoices,{...props,...extra}));
  const ready=draw({});assert(ready.includes(props.choices[0].text));assert(!ready.includes(props.choices[0].label));assert(!ready.includes('Слушать A'));assert(!ready.includes('Показать текст A'));assert(!ready.includes('Скрыть текст A'));
  const select=extra=>choiceButtons({...props,...extra}).find(button=>button.label.includes('Выбрать A'));
  assert.equal(select({}).disabled,false);select({}).onClick();assert.deepEqual(calls,[['choose',0]]);
  for(const extra of [{canAdvance:false},{ready:false}]){assert(draw(extra).includes(props.choices[0].text));assert.equal(select(extra).disabled,true);}
  const translated=draw({translationOpen:true});assert(translated.includes(props.choices[0].text));assert(translated.includes(props.choices[0].label));
 }
});

test('Scene and route playback skip missing recordings while keeping the original clip indices',()=>{
 const story=fixture();story.nodes.start.clips.unshift({...clip('text-only'),source:''});
 const snapshot=structuredClone(story),scene=scenePlaylist(story,'start');
 assert.deepEqual(scene.map(entry=>[entry.clip.id,entry.clipIndex]),[['intro-1',1],['intro-2',2]]);
 assert(routePlaylist(story,[0]).every(entry=>!!entry.clip.source));
 assert.deepEqual(exercisePlaylist(story,[],[{nodeId:'start',clipId:'text-only'}]),[]);
 assert.deepEqual(story,snapshot);
 story.nodes.start.clips=story.nodes.start.clips.slice(0,1);assert.deepEqual(scenePlaylist(story,'start'),[]);
});

test('Speaker labels use explicit story actors and never infer identity from a voice prefix',()=>{
 const story={comic:{actors:[{id:'traveler',name:'Сэм'}]}};
 assert.equal(characterName(story,{actorId:'traveler',voice:'im_nicola'}),'Сэм');
 assert.equal(characterName(story,{actorId:'traveler',actorName:'Ты',voice:'bf_emma'}),'Ты');
 assert.equal(characterName(story,{voice:'bf_emma'}),'Персонаж');
});
