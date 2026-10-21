'use client';
import {useId,useState} from 'react';
import type {CourseStory} from '../lib/story-course-types';
import {storyRoute} from './story-course-state';
import {hasRecordedClip,type StoryPlaylistEntry} from './story-playlist';

type SpeakingChoice={nodeId:string;choiceIndex:number;text:string;label:string;entry:StoryPlaylistEntry|null};
type SpeakingPracticeProps={
 story:CourseStory;path:number[];ready:boolean;listening:boolean;
 onListen:(entry:StoryPlaylistEntry)=>void;onStop:()=>void;
};

// The last visited node may offer choices, but none of those choices belongs to
// the learner's route yet. Inspect only the explicit selections in path.
export function storySpeakingChoice(story:CourseStory,path:number[]):SpeakingChoice|null{
 let route:string[];
 try{route=storyRoute(story,path);}catch{return null;}
 for(let index=path.length-1;index>=0;index--){
  const nodeId=route[index],choiceIndex=path[index];
  if(!Number.isInteger(choiceIndex))continue;
  const choice=story.nodes[nodeId]?.choices[choiceIndex];
  if(!choice?.text.trim()||!choice.label.trim())continue;
  return {nodeId,choiceIndex,text:choice.text,label:choice.label,entry:hasRecordedClip(choice.clip)?{clip:choice.clip,nodeId,kind:'choice',clipIndex:0,choiceIndex}:null};
 }
 return null;
}

export function StorySpeakingPractice(props:SpeakingPracticeProps){
 const choice=storySpeakingChoice(props.story,props.path);
 if(!props.ready||!choice)return null;
 // A different story or route mounts a fresh prompt, so a previously opened
 // answer cannot flash on screen before an effect resets local state.
 return <SpeakingPrompt key={JSON.stringify([props.story.id,props.path])} {...props} choice={choice}/>;
}

function SpeakingPrompt({story,choice,listening,onListen,onStop}:SpeakingPracticeProps&{choice:SpeakingChoice}){
 const [revealed,setRevealed]=useState(false),id=useId(),entry=choice.entry;
 return <section className="speaking-practice" aria-labelledby={id+'-title'}>
  <header className="speaking-practice-header"><h2 id={id+'-title'}>Минута своей речи</h2><p>Попробуй сказать вслух {story.language==='it'?'по-итальянски':'по-английски'}.</p></header>
  <ol className="speaking-practice-steps">
   <li>Перескажи в 2–3 предложениях, какое решение приняли герои.</li>
   <li>Вспомни свой выбранный ответ по подсказке:<blockquote className="speaking-practice-cue" lang="ru">{choice.label}</blockquote></li>
  </ol>
  <button type="button" className="button secondary" aria-expanded={revealed} aria-controls={id+'-sample'} onClick={()=>{if(revealed&&listening)onStop();setRevealed(value=>!value);}}>{revealed?'Скрыть образец':'Сравнить с ответом героя'}</button>
  <div id={id+'-sample'} className="speaking-practice-sample" hidden={!revealed}>{revealed&&<>
   <p lang={story.language}>{choice.text}</p>
   {entry&&<button type="button" className="button secondary small-button" onClick={()=>listening?onStop():onListen(entry)}>{listening?'Остановить образец':'Послушать образец'}</button>}
   <p className="speaking-practice-transfer">Теперь измени одну деталь и скажи по-своему.</p>
  </>}</div>
 </section>;
}
