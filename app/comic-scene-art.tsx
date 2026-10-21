import type {CourseStory} from '../lib/story-course-types';
import StoryArt from './story-art';

type Prop='phone'|'map'|'clock'|'ticket'|'cup'|'book'|'camera'|'tools'|'parcel'|'umbrella'|'laptop'|'conversation';
const props:readonly [Prop,RegExp][]=[
 ['phone',/сообщени|написа|позвон|телефон|звонк|созвон/],
 ['map',/карт[аеуы]|маршрут|адрес|вход|встретимся у/],
 ['ticket',/билет|платформ|поезд|автобус|паром/],
 ['clock',/врем|минут|час|опоз|раньше|позже/],
 ['umbrella',/дожд|погод|ливень/],['tools',/ремонт|почин|инструмент/],
 ['parcel',/посылк|доставк|коробк|ключ/],['camera',/фото|камер/],
 ['book',/книг|письм|архив|прочит|чита/],['cup',/кофе|кафе|заказ|ужин|обед|еда|меню/],
 ['laptop',/проект|работ|экран|презентаци|команд|задач/],
];

// Illustrations follow only the current scene and choices already made. They never
// inspect future nodes or expose the target-language transcript before listening.
export function sceneVisual(story:CourseStory,nodeId:string,path:number[]){
 const node=story.nodes[nodeId],phase=nodeId===story.start?'opening':node.choices.length?'turn':'ending';
 const text=node.clips.map(c=>c.ru).join(' ').toLocaleLowerCase('ru');
 const prop:Prop=!story.legacy&&nodeId.endsWith('-message')?'phone':!story.legacy&&nodeId.endsWith('-together')?'conversation':props.find(([,pattern])=>pattern.test(text))?.[0]||({coffee:'cup',train:'ticket',work:'laptop',film:'conversation'} as const)[story.art];
 const branch=path.reduce((sum,n,i)=>sum+(n+1)*(i+1),0);
 return {phase,prop,branch,frame:path.length+1};
}

function SceneProp({kind}:{kind:Prop}){
 const ink='#25332e',paper='#fffdf3',blue='#b6d9e9',yellow='#ffdb55';
 return <g stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
  {kind==='phone'?<><rect x="-21" y="-42" width="42" height="76" rx="7" fill={ink}/><rect x="-16" y="-32" width="32" height="53" rx="2" fill={blue}/><path d="M-10-20h20v19H1l-8 7v-7h-3z" fill={paper}/><path d="M-5-12h10m-10 6h6"/><circle cy="27" r="2" fill={paper}/></>:
  kind==='map'?<><path d="M-48-25l32-9L16-23l32-9v60L16 38l-32-10-32 10z" fill={paper}/><path d="M-16-34v62m32-51v61" stroke={blue}/><path d="M-34 18l15-18L7 10l22-28" fill="none" stroke="#ca6b50" strokeDasharray="5 6"/><path d="M29-30c-16 0-14 18 0 29 14-11 16-29 0-29z" fill={yellow}/><circle cx="29" cy="-19" r="3" fill={ink}/></>:
  kind==='clock'?<><circle r="37" fill={paper}/><path d="M0-27v6m27 6-5 2M0 27v-6m-27-6 5 2M0-18V0l17 9" fill="none"/><circle r="3" fill={ink}/></>:
  kind==='ticket'?<><path d="M-49-24h98v14c-15 0-15 20 0 20v15h-98V10c15 0 15-20 0-20z" fill={yellow}/><path d="M22-20v40" strokeDasharray="4 4"/><path d="M-32-10h36m-36 12h26m-26 12h17"/></>:
  kind==='cup'?<><path d="M-29-15h50v29c0 27-50 27-50 0z" fill={paper}/><path d="M22-10c34-9 31 33 0 24M-38 38h70M-17-26c-12-12 10-14 0-26m19 26c-12-12 10-14 0-26" fill="none"/></>:
  kind==='book'?<><path d="M0-25c-20-14-34-10-45-7v64c18-5 31-3 45 6 14-9 27-11 45-6v-64c-11-3-25-7-45 7z" fill={paper}/><path d="M0-25v63M-34-16l23 4m-23 9 23 4m-23 9 23 4m22-26 23-4M11 1l23-4m-23 17 23-4" fill="none"/></>:
  kind==='camera'?<><rect x="-43" y="-23" width="86" height="56" rx="7" fill={blue}/><path d="M-22-23l7-12H8l8 12" fill={blue}/><circle cy="5" r="20" fill={ink}/><circle cy="5" r="12" fill={paper}/><circle cx="30" cy="-11" r="3" fill={yellow}/></>:
  kind==='tools'?<><path d="M-24-37c-28 4-23 35-4 36l38 39 14-14-38-39c3-20-6-26-10-22l5 15-13 6-7-12z" fill={blue}/><path d="M35-32l9 9L-20 38l-11-11z" fill={yellow}/></>:
  kind==='parcel'?<><path d="M-40-22L0-40l40 18v58H-40z" fill="#dcab79"/><path d="M-40-22H40M0-40v76M-15 13h-17v14h17" fill="none"/><path d="M-9-22H9v23H-9z" fill={paper}/></>:
  kind==='umbrella'?<><path d="M-46 0a46 46 0 0 1 92 0q-13-10-23 0Q11-10 0 0q-12-10-23 0-12-10-23 0z" fill={yellow}/><path d="M0-47v78c0 20 23 18 23 1M-35-56l-5 10m76-10-5 10" fill="none"/></>:
  kind==='laptop'?<><rect x="-41" y="-31" width="82" height="55" rx="5" fill={ink}/><rect x="-34" y="-24" width="68" height="40" rx="2" fill={blue}/><path d="M-41 24l-11 14H52L41 24z" fill={paper}/><path d="M-22-10H21M-22 2H9"/></>:
  <><path d="M-44-34h56v37H-9l-16 12V3h-19z" fill={paper}/><path d="M-5 5h48v31H27l-1 12-13-12H-5z" fill={yellow}/><path d="M-32-20H0m-32 11h20m20 25h24m-24 10h17"/></>}
 </g>;
}

function Character({x,y,shirt,second=false,speaking=false,pose=0}:{x:number;y:number;shirt:string;second?:boolean;speaking?:boolean;pose?:number}){
 const skin=second?'#c99068':'#f0bc91',hair=second?'#293d38':'#784d3e';
 return <g transform={`translate(${x} ${y})`} className={speaking?'comic-person is-speaking':'comic-person'}>
  <ellipse cy="117" rx="49" ry="9" fill="#25332e" opacity=".13"/>
  {speaking&&<ellipse cy="19" rx="45" ry="55" fill="none" stroke="#ecb929" strokeWidth="5" className="comic-speaker-halo"/>}
  <g stroke="#25332e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
   <path d="M-24 70l-7 40h23l8-35 9 35h22L24 70" fill="#3c5653"/>
   <path d="M-23 25q-23 22-16 49 38 16 78 0 5-34-16-49z" fill={shirt}/>
   <path d={pose%2?'M-30 40l-28 4-9-28M30 40l25 21':'M-30 40l-17 30M30 40l31-7 7-22'} fill="none" stroke={shirt} strokeWidth="14"/>
   <circle cx={pose%2?-67:68} cy={pose%2?14:10} r="7" fill={skin}/>
   <rect x="-8" y="14" width="16" height="19" rx="5" fill={skin}/>
   <ellipse cy="-6" rx="27" ry="32" fill={skin}/>
   <path d={second?'M-28-9q-9-43 23-33 35-9 32 33L9-28-9-22z':'M-27-6q-13-45 22-38 35-3 31 35L5-29-18-18l-4 20z'} fill={hair}/>
   <path d="M-13-7h2m22 0h2" strokeWidth="4"/>
   {speaking?<ellipse cy="8" rx="6" ry="7" fill="#884e3f"/>:<path d={pose%3?'M-8 7q8 8 16 0':'M-6 9h12'} fill="none"/>}
  </g>
 </g>;
}

export default function ComicSceneArt({story,nodeId,path,voice,playing=false}:{story:CourseStory;nodeId:string;path:number[];voice?:string;playing?:boolean}){
 const {phase,prop,branch,frame}=sceneVisual(story,nodeId,path),ending=phase==='ending',opening=phase==='opening';
 const actors=[...new Set(Object.values(story.nodes).flatMap(n=>n.clips.map(c=>c.voice)))];
 const rightSpeaking=actors.indexOf(voice||'')>0,side=branch%2===0;
 const background=opening?'translate(0 -20) scale(1)':ending?'translate(-90 -80) scale(1.35)':side?'translate(-45 -60) scale(1.2)':'translate(-110 -40) scale(1.2)';
 return <svg className="scene-art comic-scene-drawing" viewBox="0 0 580 330" role="img" aria-label={`Кадр ${frame}: ${opening?'начало истории':ending?'развязка':'диалог после твоего выбора'}`}>
  <rect width="580" height="330" fill="#e5eadd"/>
  <g transform={background} opacity=".7"><StoryArt kind={story.art}/></g>
  <path d="M0 260q290-35 580 0v70H0z" fill="#e7d2b2"/>
  <g key={nodeId} className="comic-frame-arrival" data-scene={nodeId} data-prop={prop}>
   <Character x={opening?160:side?150:185} y={opening?177:165} shirt="#d88163" speaking={playing&&!rightSpeaking} pose={opening?0:branch+1}/>
   <Character x={opening?430:side?400:440} y={opening?177:165} shirt="#6f9eaa" second speaking={playing&&rightSpeaking} pose={opening?1:branch+2}/>
   <g transform={`translate(${opening?294:side?305:290} ${opening?112:ending?100:125}) scale(${opening?0.72:1})`}>
    <path d="M-68-59q70-24 134 0l-4 115q-60 20-128 0z" fill="#fffdf3" stroke="#25332e" strokeWidth="2"/>
    <SceneProp kind={prop}/>
   </g>
   {ending&&<path d="M224 74l-12-17m142 20 13-16m-77-8V34" fill="none" stroke="#d19b23" strokeWidth="5" strokeLinecap="round"/>}
  </g>
 </svg>;
}
