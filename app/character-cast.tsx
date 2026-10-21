import {ArrowRight,BookOpen,Headphones,Play,Square} from 'lucide-react';
import type {CourseStory,StoryChoice,StoryClip} from '../lib/story-course-types';
import {CharacterPortrait} from './comic-stage';
import {hasRecordedClip} from './story-playlist';

export function characterName(story:CourseStory,clip?:StoryClip){
 const actor=story.comic?.actors?.find(actor=>actor.id===clip?.actorId);
 return clip?.actorName||actor?.name||'Персонаж';
}

export function CharacterCast({story,activeActorId}:{story:CourseStory;activeActorId?:string}){
 const actors=story.comic?.actors;
 if(!actors?.length)return null;
 return <section className="character-cast" aria-label="Персонажи этой истории"><p className="character-cast-heading">В этой истории</p><div className="character-cast-list">{actors.map(actor=><div key={actor.id} className={'character-cast-card'+(activeActorId===actor.id?' speaking':'')}>
  <CharacterPortrait artBase={actor.artBase} className="character-cast-portrait"/>
  <div><strong>{actor.name}</strong><span>{actor.label}</span><small>{actor.id===story.comic?.playerActorId?'Твоя роль':'Собеседник'}</small></div>
 </div>)}</div></section>;
}

export function StoryChoices({choices,language,ready,canAdvance,textOpen,translationOpen,playingChoice,onListen,onChoose,onReveal}:{
 choices:StoryChoice[];language:string;ready:boolean;canAdvance:boolean;
 textOpen:number[];translationOpen:number[];playingChoice:number|null;
 onListen:(index:number)=>void;onChoose:(index:number)=>void;onReveal:(index:number,translation:boolean)=>void;
}){
 return <div>{choices.map((choice,index)=>{
  const letter=String.fromCharCode(65+index),recorded=hasRecordedClip(choice.clip),disabled=!ready||!canAdvance;
  if(!recorded)return <div className="character-choice-fallback" key={index}>
   <p>Ответ {letter} · запись пока недоступна</p>
   <button className="comic-choice" disabled={disabled} onClick={()=>onChoose(index)}><span className="comic-choice-letter">{letter}</span><span><strong lang={canAdvance?language:undefined}>{canAdvance?choice.text:`Текстовый ответ ${letter}`}</strong>{canAdvance&&translationOpen.includes(index)&&<small>{choice.label}</small>}</span><ArrowRight size={20}/></button>
   {canAdvance&&<button className="text-button" disabled={!ready} onClick={()=>onReveal(index,true)}>{translationOpen.includes(index)?`Скрыть перевод ${letter}`:`Перевод ${letter}`}</button>}
  </div>;
  const listening=playingChoice===index;
  return <article className="character-choice" aria-label={`Ответ ${letter}`} key={index}>
   <div className="character-choice-heading"><span className="comic-choice-letter">{letter}</span><span><Headphones size={16}/> Ответ в аудио</span></div>
   <div className="character-choice-actions"><button className="button secondary" disabled={disabled} aria-pressed={listening} onClick={()=>onListen(index)}>{listening?<Square size={17}/>:<Play size={17}/>} {listening?`Остановить ${letter}`:`Слушать ${letter}`}</button><button className="button primary" disabled={disabled} onClick={()=>onChoose(index)}>Выбрать {letter}<ArrowRight size={17}/></button></div>
   {textOpen.includes(index)&&<p className="character-choice-text" lang={language}>{choice.text}</p>}
   {translationOpen.includes(index)&&<p className="character-choice-translation">{choice.label}</p>}
   <div className="character-choice-help"><button className="text-button" disabled={disabled} aria-expanded={textOpen.includes(index)} onClick={()=>onReveal(index,false)}><BookOpen size={15}/>{textOpen.includes(index)?`Скрыть текст ${letter}`:`Текст ${letter}`}</button><button className="text-button" disabled={disabled} aria-expanded={translationOpen.includes(index)} onClick={()=>onReveal(index,true)}>{translationOpen.includes(index)?`Скрыть перевод ${letter}`:`Перевод ${letter}`}</button></div>
  </article>;
 })}</div>;
}
