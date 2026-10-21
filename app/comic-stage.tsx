'use client';
import {BookOpen,Camera,Clock,Coffee,Laptop,Map,MessageCircle,Package,Smartphone,Ticket,Umbrella,Wrench,Search,Lock} from 'lucide-react';
import type {ComicActor,ComicLocation,ComicMood,ComicPanel} from '../lib/comic-types';
import type {CourseStory,JourneyProgress} from '../lib/story-course-types';

export const locationNames:Record<ComicLocation,string>={cafe:'Кафе',station:'Вокзал',square:'Городская площадь',home:'Дом',office:'Мастерская и работа',park:'Сад у реки',gallery:'Культурное пространство',market:'Рынок'};
const props={phone:Smartphone,clock:Clock,map:Map,cup:Coffee,book:BookOpen,ticket:Ticket,camera:Camera,parcel:Package,tools:Wrench,umbrella:Umbrella,laptop:Laptop,conversation:MessageCircle};
const moods:ComicMood[]=['neutral','speaking','thinking','pleased'];
export function comicPose(panel:ComicPanel,position:number,playing:boolean,motion:boolean):ComicMood {
 return playing&&motion&&position>=panel.beatAt?'speaking':panel.mood;
}
export function CharacterPortrait({artBase,pose='neutral',className='',artLayout}:{artBase:string;pose?:ComicMood;className?:string;artLayout?:'separate'|'sheet-2x2'}){
 const sheet=artLayout==='sheet-2x2'||artBase.startsWith('/comics/characters/v1/');
 return sheet?<span className={`character-art pose-${pose} ${className}`} aria-hidden="true"><img src={`${artBase}-sheet.png`} alt="" width={1024} height={1280} loading="lazy" draggable={false}/></span>:<img className={className} src={`${artBase}-${pose}.webp`} alt="" width={400} height={500} loading="lazy" draggable={false}/>;
}
function Actor({kind,mood,actor,active=false}:{kind:'female'|'male';mood:ComicMood;actor?:ComicActor;active?:boolean}){
 return <div className={'novel-actor '+kind+(active?' active':'')} aria-hidden="true">{actor?<CharacterPortrait artBase={actor.artBase} artLayout={actor.artLayout} pose={mood}/>:moods.map(pose=><img key={pose} src={`/comics/v1/${kind}-${pose}.webp`} alt="" width={400} height={500} draggable={false} className={mood===pose?'visible':''}/>)}</div>;
}
export function ComicCover({location,position=1,actor}:{location:ComicLocation;position?:number;actor?:Pick<ComicActor,'artBase'|'artLayout'|'label'>}){
 const artBase=actor?.artBase||`/comics/characters/v1/${position%2?'traveler':'cartographer'}`;
 return <div className="novel-cover" aria-hidden="true"><img className="novel-cover-bg" src={`/comics/v1/${location}.webp`} alt="" width={1280} height={853} loading="lazy"/><CharacterPortrait className="novel-cover-actor" artBase={artBase} artLayout={actor?.artLayout}/></div>;
}
export function ComicStage({story,nodeId,frame,voice,actorId,actorName,playing,position,duration,motion,inspected,onInspect,disabled,previous}:{story:CourseStory;nodeId:string;frame:number;voice:string;actorId?:string;actorName?:string;playing:boolean;position:number;duration:number;motion:boolean;inspected:boolean;onInspect:()=>void;disabled:boolean;previous?:string}){
 const board=story.comic!,panel=board.scenes[nodeId],Icon=props[panel.prop];
 const activeIndex=board.actors?board.actors.findIndex(actor=>actor.id===actorId):voice.startsWith('if_')||voice.startsWith('bf_')?0:1,pose=comicPose(panel,position,playing,motion);
 const castDescription=board.actors?board.actors.map(actor=>actor.name).join(' и '):'Лиса-путешественница и ворон-картограф';
 const speaker=actorName||board.actors?.[activeIndex]?.name||board.cast[activeIndex]||'персонаж';
 return <div className={'novel-stage-wrap'+(motion?' motion':' static')}>
  <figure className={'novel-stage shot-'+panel.shot} key={nodeId} aria-label={`${locationNames[panel.location]}. ${castDescription}.`}>
   <img className="novel-backdrop" src={`/comics/v1/${panel.location}.webp`} alt="" width={1280} height={853} fetchPriority="high"/>
   <div className="novel-actors"><Actor kind="female" actor={board.actors?.[0]} mood={activeIndex===0?pose:panel.mood} active={playing&&activeIndex===0}/><Actor kind="male" actor={board.actors?.[1]} mood={activeIndex===1?pose:panel.mood} active={playing&&activeIndex===1}/></div>
   <span className="comic-number">КАДР {frame}</span>
   <figcaption className="novel-caption">{panel.caption}</figcaption>
   <button className="novel-hotspot" disabled={disabled} aria-expanded={inspected} aria-controls="scene-detail" onClick={onInspect}><Icon size={23}/><span>{inspected?'Закрыть деталь':'Осмотреть'}<small>Подсказка с переводом</small></span><Search size={16}/></button>
  </figure>
  <div className="novel-scene-footer"><span>{locationNames[panel.location]}</span><span>{playing?`Говорит ${speaker}`:'Слушай, замечай, решай'}</span></div>
  {playing&&<progress className="novel-audio-progress" aria-label="Позиция текущей реплики" max={duration||1} value={Math.min(position,duration||1)}/>}
  {previous&&<p className="novel-memory"><span>Твоё решение</span> {previous}</p>}
  {inspected&&<aside id="scene-detail" className="novel-detail"><b>{panel.clue.title}</b><p>{panel.clue.body}</p><small>Открытие этой детали учитывается как помощь чтением.</small></aside>}
 </div>;
}
export function EndingCollection({story,progress,current}:{story:CourseStory;progress:JourneyProgress;current:string}){
 const opened=new Set([...(progress.endings||[]),...(progress.finishedAt?[current]:[])]);
 const endings=Object.entries(story.nodes).filter(([,n])=>!n.choices.length);
 return <section className="novel-collection" aria-label="Коллекция финалов"><div className="novel-collection-heading"><h2>Другие стороны истории</h2><span>{endings.filter(([id])=>opened.has(id)).length} / {endings.length} открыто</span></div><p>Пройди другим путём и узнай, к чему приведёт новый выбор.</p><div className="novel-endings">{endings.map(([id,n],i)=>opened.has(id)?<details className="novel-ending-card" key={id}><summary><BookOpen size={18}/><span>{n.outcome?.title}</span></summary>{story.comic&&<ComicCover location={story.comic.scenes[id].location} position={i} actor={story.comic.actors?.[0]}/>}<p>{n.outcome?.body}</p></details>:<div className="novel-ending-locked" key={id}><Lock size={20}/><b>Финал {i+1}</b><span>Откроется после прохождения</span></div>)}</div></section>;
}
