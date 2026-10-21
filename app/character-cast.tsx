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
 textOpen:number[];translationOpen:boolean;playingChoice:number|null;
 onListen:(index:number)=>void;onChoose:(index:number)=>void;onReveal:(index:number)=>void;
}){
 return <div>{choices.map((choice,index)=>{
  const letter=String.fromCharCode(65+index),recorded=hasRecordedClip(choice.clip),disabled=!ready||!canAdvance;
  const listening=recorded&&playingChoice===index,textVisible=canAdvance&&textOpen.includes(index),translationVisible=canAdvance&&translationOpen;
  const selectionDisabled=disabled||(!recorded&&!textVisible&&!translationVisible);
  return <article className="character-choice" aria-label={`Ответ ${letter}`} key={index}>
   <div className="character-choice-heading"><span className="comic-choice-letter">{letter}</span><span>{recorded?<><Headphones size={16}/> Ответ в аудио</>:<><BookOpen size={16}/> Запись ответа пока недоступна</>}</span></div>
   <div className="character-choice-actions">{recorded&&<button className="button secondary" disabled={disabled} aria-pressed={listening} onClick={()=>onListen(index)}>{listening?<Square size={17}/>:<Play size={17}/>} {listening?`Остановить ${letter}`:`Слушать ${letter}`}</button>}<button className="button primary" disabled={selectionDisabled} onClick={()=>onChoose(index)}>Выбрать {letter}<ArrowRight size={17}/></button></div>
   {textVisible&&<p className="character-choice-text" lang={language}>{choice.text}</p>}
   {translationVisible&&<p className="character-choice-translation" lang="ru">{choice.label}</p>}
   <div className="character-choice-help"><button className="text-button" disabled={disabled} aria-expanded={textVisible} onClick={()=>onReveal(index)}><BookOpen size={15}/>{textVisible?`Скрыть текст ${letter}`:`Показать текст ${letter}`}</button></div>
  </article>;
 })}</div>;
}
