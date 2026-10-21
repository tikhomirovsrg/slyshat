'use client';
import {BookOpen,Camera,Clock,Coffee,Laptop,Map,MessageCircle,Package,Smartphone,Ticket,Umbrella,Wrench,Search,Lock} from 'lucide-react';
import type {ComicLocation,ComicMood,ComicPanel} from '../lib/comic-types';
import type {CourseStory,JourneyProgress} from '../lib/story-course-types';

export const locationNames:Record<ComicLocation,string>={cafe:'Кафе',station:'Вокзал',square:'Городская площадь',home:'Дом',office:'Мастерская и работа',park:'Сад у реки',gallery:'Культурное пространство',market:'Рынок'};
const props={phone:Smartphone,clock:Clock,map:Map,cup:Coffee,book:BookOpen,ticket:Ticket,camera:Camera,parcel:Package,tools:Wrench,umbrella:Umbrella,laptop:Laptop,conversation:MessageCircle};
const moods:ComicMood[]=['neutral','speaking','thinking','pleased'];
export function comicPose(panel:ComicPanel,position:number,playing:boolean,motion:boolean):ComicMood {
 return playing&&motion&&position>=panel.beatAt?'speaking':panel.mood;
}
function Actor({kind,mood,active=false}:{kind:'female'|'male';mood:ComicMood;active?:boolean}){
 return <div className={'novel-actor '+kind+(active?' active':'')} aria-hidden="true">{moods.map(pose=><img key={pose} src={`/comics/v1/${kind}-${pose}.webp`} alt="" width={400} height={500} draggable={false} className={mood===pose?'visible':''}/>)}</div>;
}
export function ComicCover({location,position=1}:{location:ComicLocation;position?:number}){
 const kind=position%2?'female':'male';
 return <div className="novel-cover" aria-hidden="true"><img className="novel-cover-bg" src={`/comics/v1/${location}.webp`} alt="" width={1280} height={853} loading="lazy"/><img className="novel-cover-actor" src={`/comics/v1/${kind}-neutral.webp`} alt="" width={400} height={500} loading="lazy"/></div>;
}
export function ComicStage({story,nodeId,frame,voice,playing,position,duration,motion,inspected,onInspect,disabled,previous}:{story:CourseStory;nodeId:string;frame:number;voice:string;playing:boolean;position:number;duration:number;motion:boolean;inspected:boolean;onInspect:()=>void;disabled:boolean;previous?:string}){
 const board=story.comic!,panel=board.scenes[nodeId],Icon=props[panel.prop];
 const female=voice.startsWith('if_')||voice.startsWith('bf_'),pose=comicPose(panel,position,playing,motion);
 return <div className={'novel-stage-wrap'+(motion?' motion':' static')}>
  <figure className={'novel-stage shot-'+panel.shot} key={nodeId} aria-label={`${locationNames[panel.location]}. Лиса-путешественница и ворон-картограф.`}>
   <img className="novel-backdrop" src={`/comics/v1/${panel.location}.webp`} alt="" width={1280} height={853} fetchPriority="high"/>
   <div className="novel-actors"><Actor kind="female" mood={female?pose:panel.mood} active={playing&&female}/><Actor kind="male" mood={!female?pose:panel.mood} active={playing&&!female}/></div>
   <span className="comic-number">КАДР {frame}</span>
   <figcaption className="novel-caption">{panel.caption}</figcaption>
   <button className="novel-hotspot" disabled={disabled} aria-expanded={inspected} aria-controls="scene-detail" onClick={onInspect}><Icon size={23}/><span>{inspected?'Закрыть деталь':'Осмотреть'}<small>Подсказка с переводом</small></span><Search size={16}/></button>
  </figure>
  <div className="novel-scene-footer"><span>{locationNames[panel.location]}</span><span>{playing?`Говорит ${board.cast[female?0:1]}`:'Слушай, замечай, решай'}</span></div>
  {playing&&<progress className="novel-audio-progress" aria-label="Позиция текущей реплики" max={duration||1} value={Math.min(position,duration||1)}/>}
  {previous&&<p className="novel-memory"><span>Твоё решение</span> {previous}</p>}
  {inspected&&<aside id="scene-detail" className="novel-detail"><b>{panel.clue.title}</b><p>{panel.clue.body}</p><small>Открытие этой детали учитывается как помощь чтением.</small></aside>}
 </div>;
}
export function EndingCollection({story,progress,current}:{story:CourseStory;progress:JourneyProgress;current:string}){
 const opened=new Set([...(progress.endings||[]),...(progress.finishedAt?[current]:[])]);
 const endings=Object.entries(story.nodes).filter(([,n])=>!n.choices.length);
 return <section className="novel-collection" aria-label="Коллекция финалов"><div className="novel-collection-heading"><h2>Другие стороны истории</h2><span>{endings.filter(([id])=>opened.has(id)).length} / {endings.length} открыто</span></div><p>Пройди другим путём и узнай, к чему приведёт новый выбор.</p><div className="novel-endings">{endings.map(([id,n],i)=>opened.has(id)?<details className="novel-ending-card" key={id}><summary><BookOpen size={18}/><span>{n.outcome?.title}</span></summary>{story.comic&&<ComicCover location={story.comic.scenes[id].location} position={i}/>}<p>{n.outcome?.body}</p></details>:<div className="novel-ending-locked" key={id}><Lock size={20}/><b>Финал {i+1}</b><span>Откроется после прохождения</span></div>)}</div></section>;
}
