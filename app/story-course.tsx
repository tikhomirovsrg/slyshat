'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Headphones,Play,Square,BookOpen,Check,RotateCcw} from 'lucide-react';
import type {Language} from './episodes';
import {languageNames} from './episodes';
import type {Progress} from './learning';
import type {Profile} from './use-profile';
import type {CourseStory,JourneyProgress,StoryCard,StoryCatalog} from '../lib/story-course-types';
import {assistJourney,legacyJourney,nextStory,resumeStory,restartJourney,storyFinished,storyRoute} from './story-course-state';
import {levels} from './study-types';
import {useSpeechPlayer} from './speech';
import StoryArt from './story-art';
import ComicSceneArt from './comic-scene-art';
import {ComicCover,ComicStage,EndingCollection} from './comic-stage';
import {playbackSpeeds,speedLabel} from '../lib/playback-speed';
import {CharacterCast,StoryChoices,characterName} from './character-cast';
import {exercisePlaylist,hasRecordedClip,playStoryPlaylist,routePlaylist,scenePlaylist,type StoryPlaylistEntry} from './story-playlist';
import {buildStoryExercises} from '../lib/story-exercises.mjs';
import {answerExercise,assistExercises,exerciseSummary,restartExercises} from '../lib/story-exercise-state';
import {StoryExercises} from './story-exercises';
import {StorySpeakingPractice} from './story-speaking-practice';
import {StoryVocabulary} from './story-vocabulary';
import {currentStoryReading,emptyStoryReading,storyReadingKey,toggleChoiceReading,toggleStoryReading} from './story-reading-state';

type Props={language:Language;profile:Profile;book:Record<string,Progress>;speed:number;onSpeed:(speed:number)=>void;onLanguage:(lang:Language)=>void;initialStory?:string|null;onLeave?:()=>void;onStoryOpen?:(id:string)=>void};
const cardLabels={en:{done:'✓ Ending unlocked',started:'In progress',fresh:'New story',open:'Open story',resume:'Continue',start:'Start story',featured:'★ A story with Giulia · '},it:{done:'✓ Finale sbloccato',started:'In corso',fresh:'Nuova storia',open:'Apri la storia',resume:'Continua',start:'Inizia la storia',featured:'★ Una storia con Giulia · '}};
const scrollTop=()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
export function StoryCourse({language,profile,book,speed,onSpeed,onLanguage,initialStory,onLeave,onStoryOpen}:Props){
 const [catalog,setCatalog]=useState<StoryCatalog|null>(null),[story,setStory]=useState<CourseStory|null>(null),[selected,setSelected]=useState(initialStory||''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [level,setLevel]=useState('all'),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[series,setSeries]=useState('all'),[topic,setTopic]=useState('all'),[page,setPage]=useState(1);
 const {stop}=useSpeechPlayer();
 useEffect(()=>{setSeries('all');setTopic('all');setPage(1);},[language]);
 useEffect(()=>{if(initialStory)setSelected(initialStory);},[initialStory]);
 useEffect(()=>{const abort=new AbortController();setCatalog(null);setError('');void fetch('/api/stories?'+new URLSearchParams({language}),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Не удалось загрузить истории.');return r.json();}).then(data=>{if(!abort.signal.aborted)setCatalog(data);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[language,retry]);
 useEffect(()=>{setStory(null);if(!selected)return;const abort=new AbortController();setError('');void fetch('/api/stories?'+new URLSearchParams({id:selected}),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Не удалось открыть историю.');return r.json();}).then(data=>{if(!abort.signal.aborted)setStory(data);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[selected,retry]);
 const open=(id:string)=>{stop();setError('');setSelected(id);onStoryOpen?.(id);scrollTop();};
 const close=()=>{stop();setSelected('');onLeave?.();scrollTop();};
 const filtered=catalog?.items.filter(s=>(series==='all'||s.comic?.series===series)&&(topic==='all'||s.topic===topic)&&(level==='all'||s.level===level)&&(!query.trim()||[s.title,s.topic,s.summary,s.comic?.hook,s.comic?.series,String(s.position)].join(' ').toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)))&&(status==='all'||(status==='done'?storyFinished(s,profile.data.journey,book):!storyFinished(s,profile.data.journey,book))))||[];
 const pages=Math.max(1,Math.ceil(filtered.length/12)),shownPage=Math.min(page,pages),resume=catalog&&resumeStory(catalog.items,profile.data.journey,book);
 const completed=catalog?.items.filter(s=>storyFinished(s,profile.data.journey,book)).length||0;
 return <main className="comic-page">
  {error&&<div className="warning" role="alert">{error} <button className="text-button" onClick={()=>setRetry(n=>n+1)}>Повторить</button></div>}
  {selected?story?<ComicStory key={story.id} story={story} profile={profile} old={book[story.id]} speed={speed} onSpeed={onSpeed} next={catalog?nextStory(catalog.items,story.id):null} onNext={open} onClose={close}/>:<section className="comic-loading"><button className="text-button" onClick={close}>← К историям</button><p role="status">{error?'История пока недоступна. Можно повторить загрузку.':'Открываем следующий кадр…'}</p></section>:<>
   <header className="comic-hero"><div><span className="comic-kicker">СЛУШАЙ. ВЫБИРАЙ. МЕНЯЙ ИСТОРИЮ.</span><h1>Твой ответ.<br/><em>Новый поворот!</em></h1><p>Живые диалоги в комиксах. Слушай персонажей и решай, что произойдёт дальше.</p><div className="language-tabs" role="group" aria-label="Язык историй">{(['en','it'] as Language[]).map(lang=><button key={lang} className={language===lang?'active':''} aria-pressed={language===lang} onClick={()=>onLanguage(lang)}>{languageNames[lang]}</button>)}</div></div><div className="comic-hero-art" aria-hidden="true"><ComicCover location="square"/><span className="comic-sticker">А ЧТО,<br/>ЕСЛИ…?</span></div></header>
   <section className="comic-continue" aria-label="Прохождение по порядку"><div><span className="comic-kicker">ТВОЯ ЛИНИЯ СЮЖЕТА</span><h2>{resume?`Дальше: история ${resume.position}`:catalog?'Все истории пройдены!':'Собираем маршрут…'}</h2><p lang={resume?.language}>{resume?`${resume.level} · ${resume.title}`:'Можно вернуться и выбрать другой финал.'}</p><small>{completed} из {catalog?.total??'…'} пройдено · A1 → A2 → B1 → B2 → C1</small></div>{resume&&<button className="button primary" disabled={!profile.ready||profile.conflict} onClick={()=>open(resume.id)}>{profile.data.journey?.stories[resume.id]||book[resume.id]?.started?'Продолжить':'Начать по порядку'}<ArrowRight size={19}/></button>}</section>
   <div className="comic-catalog-heading"><h2>Все истории</h2><p>Иди по порядку или выбирай любую.</p></div>
   <div className="catalog-filters"><label className="search-label">Найти историю<input type="search" placeholder="Название, тема или номер…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Сложность<select value={level} onChange={e=>{setLevel(e.target.value);setPage(1);}}><option value="all">Все уровни</option>{levels.map(l=><option key={l}>{l}</option>)}</select></label><label>Тема<select value={topic} onChange={e=>{setTopic(e.target.value);setPage(1);}}><option value="all">Все темы</option>{[...new Set(catalog?.items.map(s=>s.topic))].sort((a,b)=>a.localeCompare(b,language)).map(name=><option key={name} lang={language}>{name}</option>)}</select></label><label>Серия<select value={series} onChange={e=>{setSeries(e.target.value);setPage(1);}}><option value="all">Все серии</option>{[...new Set(catalog?.items.map(s=>s.comic?.series).filter(Boolean))].map(name=><option key={name} lang={language}>{name}</option>)}</select></label><label>Прохождение<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">Все истории</option><option value="new">Ещё не пройдены</option><option value="done">Пройдены</option></select></label></div>
   <p className="catalog-count" role="status">{catalog?`${filtered.length} из ${catalog.total} историй · по 200 на каждый уровень`:'Загружаем истории…'}</p>
   <div className="comic-grid">{filtered.slice((shownPage-1)*12,shownPage*12).map(s=>{const done=storyFinished(s,profile.data.journey,book),started=!!profile.data.journey?.stories[s.id]||book[s.id]?.started,labels=cardLabels[s.language];return <article lang={s.language} className="comic-card" key={s.id}><div className={'comic-card-art theme-'+s.art} aria-hidden="true"><>{s.comic?<ComicCover location={s.comic.cover} position={s.position} actor={s.comic.coverActor}/>:<StoryArt kind={s.art}/>}</><span className="comic-number">#{String(s.position).padStart(3,'0')}</span></div><div className="comic-card-copy"><div className="comic-card-meta"><b>{s.level}</b><span>{done?labels.done:started?labels.started:labels.fresh}</span></div><h3>{s.title}</h3><p>{s.comic?.hook||s.summary}</p>{s.comic&&<small className="novel-series-name">{s.comic.featured?labels.featured:''}{s.comic.series}</small>}<button className="button primary" disabled={!profile.ready||profile.conflict} onClick={()=>open(s.id)}>{done?labels.open:started?labels.resume:labels.start}<ArrowRight size={17}/></button></div></article>;})}</div>
   {catalog&&!filtered.length&&<p className="empty-catalog">Ничего не нашлось. Попробуй другой запрос или уровень.</p>}
   {catalog&&<nav className="comic-pagination" aria-label="Страницы историй"><button className="button secondary" disabled={shownPage<=1} onClick={()=>{setPage(shownPage-1);document.querySelector('.comic-catalog-heading')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>Назад</button><span>{shownPage} / {pages}</span><button className="button secondary" disabled={shownPage>=pages} onClick={()=>{setPage(shownPage+1);document.querySelector('.comic-catalog-heading')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>Дальше</button></nav>}
   <details className="comic-about"><summary>Как устроены истории и уровни</summary><p>На каждом языке — 20 исходных историй и 980 интерактивных вариантов с развилками. Варианты развивают 25 ситуаций и используют общие сцены. Это практика разных решений в знакомом контексте. Уровни A1–C1 — учебный ориентир. Для историй подобраны составы из шести рисованных персонажей: знакомые герои играют разные роли, сохраняя свою внешность. Декорации и позы переиспользуются; у каждой сцены своя постановка. Озвучка синтетическая. Слушай варианты ответа и выбирай продолжение; текст и перевод доступны по кнопке.</p></details>
  </>}
 </main>;
}

export function ComicStory({story,profile,old,speed,onSpeed,next,onNext,onClose}:{story:CourseStory;profile:Profile;old?:Progress;speed:number;onSpeed:(speed:number)=>void;next:StoryCard|null;onNext:(id:string)=>void;onClose:()=>void}){
 const progress=profile.data.journey?.stories[story.id]||legacyJourney(story,old),route=storyRoute(story,progress.path),nodeId=route.at(-1)!,node=story.nodes[nodeId];
 const readingKey=storyReadingKey(story.id,nodeId),[reading,setReading]=useState(()=>emptyStoryReading(readingKey));
 const {revealed,translation,choiceTexts}=currentStoryReading(reading,readingKey);
 const [routeOpen,setRouteOpen]=useState(false);
 const storyRef=useRef<HTMLElement|null>(null);
 useEffect(()=>{const target=progress.finishedAt?storyRef.current?.querySelector<HTMLElement>('.comic-ending'):storyRef.current;target?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[]);
 const sceneRef=useRef<HTMLElement|null>(null),previousScene=useRef(readingKey);
 useEffect(()=>{if(previousScene.current===readingKey)return;previousScene.current=readingKey;sceneRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[readingKey]);
 const [playbackMode,setPlaybackMode]=useState<'scene'|'choice'|'dialogue'|'exercise'|'speaking'|null>(null),[activeEntry,setActiveEntry]=useState<StoryPlaylistEntry|null>(null),[playlistIndex,setPlaylistIndex]=useState(0),[playingQuestionId,setPlayingQuestionId]=useState<string|null>(null);
 const {play,stop,setPlaybackSpeed,error,state}=useSpeechPlayer();const run=useRef(0),opened=useRef(false),speedRef=useRef(speed);
 const [restarted,setRestarted]=useState(false),[inspected,setInspected]=useState(false),[motion,setMotion]=useState(false),[clock,setClock]=useState({position:0,duration:0});
 const ready=profile.ready&&!profile.conflict,canAdvance=progress.heard.includes(nodeId)||progress.assisted.includes(nodeId),finished=!!progress.finishedAt;
 const playing=playbackMode!==null,audible=playing&&state?.phase==='playing',fullPlaylist=finished?routePlaylist(story,progress.path):[];
 const exercises=useMemo(()=>finished?buildStoryExercises(story,progress.path):null,[finished,story,progress.path]);
 const exerciseAudio=useMemo<Record<string,StoryPlaylistEntry[]>>(()=>Object.fromEntries((exercises?.questions||[]).map(question=>[question.id,exercisePlaylist(story,progress.path,question.evidence)])),[exercises,story,progress.path]);
 const exerciseEvidenceAvailable=useMemo<Record<string,boolean>>(()=>Object.fromEntries(Object.entries(exerciseAudio).map(([id,entries])=>[id,entries.length>0])),[exerciseAudio]);
 const reviewing=playbackMode==='dialogue'||playbackMode==='exercise'||playbackMode==='speaking';
 const missingAnswers=finished?progress.path.length-fullPlaylist.filter(entry=>entry.kind==='choice').length:0;
 const displayNodeId=reviewing&&activeEntry?activeEntry.nodeId:nodeId,displayNode=story.nodes[displayNodeId],frame=route.indexOf(displayNodeId)+1;
 const currentClip=activeEntry?.clip||displayNode.clips[0],speakingName=characterName(story,currentClip);
 const previousChoice=frame>1?story.nodes[route[frame-2]].choices[progress.path[frame-2]]:undefined;
 const previous=previousChoice?(hasRecordedClip(previousChoice.clip)?`Ответ ${String.fromCharCode(65+progress.path[frame-2])}`:previousChoice.label):undefined;
 const save=(fn:(p:JourneyProgress)=>JourneyProgress,complete=false)=>{
  if(!ready)return;profile.update(p=>{const journey=p.journey||{active:{},stories:{}},current=journey.stories[story.id]||legacyJourney(story,old),updated=fn(current);return {...p,journey:{active:{...journey.active,[story.language]:story.id},stories:{...journey.stories,[story.id]:updated}},...(complete&&!current.finishedAt&&updated.finishedAt?{events:[...p.events,{id:'story-finish:'+story.id+':'+updated.finishedAt,at:updated.finishedAt,points:2}].slice(-2000)}:{})};});
 };
 const cancel=()=>{run.current++;stop();setPlaybackMode(null);setActiveEntry(null);setPlayingQuestionId(null);};
 useEffect(()=>{const q=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setMotion(!q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
 useEffect(()=>{if(ready&&!opened.current){opened.current=true;save(p=>({...p,updatedAt:new Date().toISOString()}));}},[ready]);
 useEffect(()=>{run.current++;stop();setPlaybackMode(null);setActiveEntry(null);setPlayingQuestionId(null);setReading(emptyStoryReading(readingKey));setRouteOpen(false);setInspected(false);setClock({position:0,duration:0});return()=>{run.current++;stop();};},[readingKey,stop]);
 useEffect(()=>{if(!ready)cancel();},[ready]);
 useEffect(()=>{speedRef.current=speed;setPlaybackSpeed(speed);},[speed,setPlaybackSpeed]);
 const listen=async(entries:StoryPlaylistEntry[],mode:'scene'|'choice'|'dialogue'|'exercise'|'speaking',questionId?:string)=>{
  if(!ready||!entries.length)return;setRestarted(false);cancel();const token=run.current;setPlaybackMode(mode);setPlayingQuestionId(questionId||null);
  if(exercises&&!exerciseSummary(exercises,progress).completed&&(mode==='dialogue'||mode==='exercise'||(mode==='scene'&&progress.heard.includes(nodeId))))save(p=>assistExercises(exercises,p,{replayed:true}));
  const complete=await playStoryPlaylist(entries,{
   isCurrent:()=>run.current===token,getSpeed:()=>speedRef.current,
   onEntry:(entry,index)=>{setActiveEntry(entry);setPlaylistIndex(index);setClock({position:0,duration:entry.clip.endAt-entry.clip.startAt});},
   play:(entry,liveSpeed,index)=>{const c=entry.clip;return play('comic-'+story.id+'-'+mode+'-'+entry.nodeId+'-'+index,{text:c.text,source:c.source,startAt:c.startAt,endAt:c.endAt,locale:story.language==='it'?'it-IT':'en-GB',speed:liveSpeed,onProgress:(position,duration)=>{if(run.current===token)setClock({position,duration});},onCancel:()=>{if(run.current===token){run.current++;setPlaybackMode(null);setActiveEntry(null);setPlayingQuestionId(null);}}});},
  });
  if(run.current!==token)return;setPlaybackMode(null);setActiveEntry(null);setPlayingQuestionId(null);
  // Replaying the finished route and listening to an answer never grants credit
  // for a scene; only an uninterrupted scene playback can add to `heard`.
  if(complete&&mode==='scene')save(p=>storyRoute(story,p.path).at(-1)===nodeId?{...p,heard:[...new Set([...p.heard,nodeId])],updatedAt:new Date().toISOString()}:p);
 };
 const listenChoice=(index:number)=>{
  if(!ready||!canAdvance||finished)return;
  if(playbackMode==='choice'&&activeEntry?.choiceIndex===index){cancel();return;}
  const clip=node.choices[index]?.clip;if(hasRecordedClip(clip))void listen([{clip,nodeId,kind:'choice',clipIndex:0,choiceIndex:index}],'choice');
 };
 const markExerciseText=()=>{if(exercises&&!exerciseSummary(exercises,progress).completed)save(p=>assistExercises(exercises,p,{text:true}));};
 const reveal=(ru=false)=>{if(!ready)return;if(ru?!translation:!revealed){if(!finished)save(p=>assistJourney(p,nodeId));else markExerciseText();}setReading(value=>toggleStoryReading(value,readingKey,ru?'translation':'revealed'));};
 const revealChoice=(index:number)=>{
  if(!ready||!canAdvance)return;
  if(!finished&&!choiceTexts.includes(index))save(p=>assistJourney(p,nodeId));
  setReading(value=>toggleChoiceReading(value,readingKey,index));
 };
 const revealRoute=(open:boolean)=>{setRouteOpen(open);if(open&&ready){if(!finished)save(p=>route.slice(0,-1).reduce((current,id)=>assistJourney(current,id),p));else markExerciseText();}};
 const inspect=()=>{if(!ready||reviewing)return;if(!inspected){if(!finished)save(p=>assistJourney(p,nodeId));else markExerciseText();}setInspected(v=>!v);};
 const replayExercise=(question:NonNullable<typeof exercises>['questions'][number])=>{
  if(!ready||!exercises||!progress.heard.includes(nodeId))return;
  if(playbackMode==='exercise'&&playingQuestionId===question.id){cancel();return;}
  const entries=exerciseAudio[question.id];if(!entries?.length)return;
  void listen(entries,'exercise',question.id);
 };
 const choose=(index:number)=>{const choice=node.choices[index];if(!choice||!canAdvance||!ready||finished||(!hasRecordedClip(choice.clip)&&!choiceTexts.includes(index)&&!translation))return;setRestarted(false);cancel();setReading(emptyStoryReading(storyReadingKey(story.id,choice.next)));save(p=>storyRoute(story,p.path).at(-1)===nodeId?{...(hasRecordedClip(choice.clip)?p:assistJourney(p,nodeId)),path:[...p.path,index],updatedAt:new Date().toISOString()}:p);};
 const finish=()=>{if(!ready||node.choices.length||!canAdvance||finished)return;cancel();save(p=>({...p,finishedAt:new Date().toISOString(),completedAt:p.completedAt||new Date().toISOString(),endings:[...new Set([...(p.endings||[]),nodeId])],updatedAt:new Date().toISOString()}),true);};
 const replay=()=>{if(!ready)return;cancel();setReading(emptyStoryReading(storyReadingKey(story.id,story.start)));setRouteOpen(false);setInspected(false);setClock({position:0,duration:0});save(p=>restartJourney(p,storyRoute(story,p.path).at(-1)!));setRestarted(true);scrollTop();};
 const leave=()=>{cancel();onClose();};
 const playbackStatus=playing?(playbackMode==='dialogue'?`Диалог · реплика ${playlistIndex+1} из ${fullPlaylist.length}`:playbackMode==='exercise'?'Фрагмент к заданию':playbackMode==='speaking'?'Образец ответа':playbackMode==='choice'?`Ответ ${String.fromCharCode(65+(activeEntry?.choiceIndex||0))}`:`Реплика ${(activeEntry?.clipIndex||0)+1} из ${displayNode.clips.length}`):progress.heard.includes(nodeId)?'✓ Сцена прослушана':'Готовая запись · слушай в своём темпе';
 return <article ref={storyRef} className="comic-story">
  <div className="comic-story-toolbar"><button className="text-button" onClick={leave}><ArrowLeft size={16}/> Все истории</button><span>#{story.position} · {story.level} · {languageNames[story.language]}</span><button className="button secondary comic-restart" disabled={!ready} onClick={replay}><RotateCcw size={16}/> С начала</button></div>
  {restarted&&<p className="comic-restart-note" role="status">История начата заново. Ранее открытые финалы сохранены.</p>}
  <header className="comic-story-title"><span className="comic-kicker">ТЫ ВЛИЯЕШЬ НА СЮЖЕТ</span><h1 lang={story.language}>{story.title}</h1><p lang={story.language}>{story.context}</p></header>
  {!!story.vocabulary?.length&&<StoryVocabulary key={story.id+':'+(nodeId===story.start?'start':'later')} entries={story.vocabulary} language={story.language} initiallyOpen={nodeId===story.start}/>}
  <CharacterCast story={story} activeActorId={audible?currentClip?.actorId:undefined}/>
  {route.length>1&&<details className="comic-route" open={routeOpen} onToggle={event=>revealRoute(event.currentTarget.open)}><summary>Твой маршрут · выбрано реплик: {progress.path.length}</summary>{routeOpen&&<ol>{progress.path.map((index,i)=><li key={i}><span>Кадр {i+1}</span><p lang={story.language}>{story.nodes[route[i]].choices[index].text}</p><small>{story.nodes[route[i]].choices[index].label}</small></li>)}</ol>}</details>}
  <section ref={sceneRef} className="comic-scene" aria-label={'Кадр '+frame}>
   {story.comic?<ComicStage story={story} nodeId={displayNodeId} frame={frame} voice={currentClip?.voice||''} actorId={currentClip?.actorId} actorName={currentClip?.actorName} playing={audible} position={clock.position} duration={clock.duration} motion={motion} inspected={reviewing?false:inspected} onInspect={inspect} disabled={!ready||reviewing} previous={previous}/>:<div className="comic-scene-art" aria-hidden="true"><ComicSceneArt story={story} nodeId={displayNodeId} path={progress.path} voice={currentClip?.voice} playing={audible}/><span className="comic-number">КАДР {frame}</span></div>}
   <div className="comic-dialogue"><div className="comic-audio-controls"><button className="button primary" disabled={!ready} onClick={()=>playing?cancel():void listen(scenePlaylist(story,nodeId),'scene')}>{playing?<Square size={18}/>:<Play size={18}/>} {playing?(state?.phase==='loading'?'Загружаем звук…':'Остановить'):'Слушать сцену'}</button><label className="comic-speed">Скорость<select aria-label="Скорость озвучки" value={speed} disabled={!ready} onChange={e=>{const value=Number(e.target.value);speedRef.current=value;setPlaybackSpeed(value);onSpeed(value);}}>{playbackSpeeds.map(value=><option key={value} value={value}>{speedLabel(value)}{value===1?' · обычная':''}</option>)}</select></label><span className="character-playback-status" role="status">{playbackStatus}</span></div>
   {playing&&<p className="character-now-speaking" role="status">{state?.phase==='loading'?'Готовится реплика: ':'Говорит: '}<strong>{speakingName}</strong>{activeEntry?.kind==='choice'?(playbackMode==='choice'?' · вариант ответа':' · твой ответ'):''}</p>}
   {error&&<p className="warning" role="alert">{error} Можно повторить или открыть текст.</p>}
   <div className="comic-bubbles">{displayNode.clips.map((c,i)=>{const speaking=audible&&activeEntry?.kind==='scene'&&activeEntry.nodeId===displayNodeId&&activeEntry.clipIndex===i;return <div key={displayNodeId+'-'+i} className={'comic-bubble '+(i%2?'reply':'')+(speaking?' speaking':'')}><b>{characterName(story,c)}</b>{revealed?<p lang={story.language}>{c.text}</p>:<p className="comic-hidden"><Headphones size={20}/><span>{speaking?'Персонаж говорит…':'Реплика звучит в аудио'}</span></p>}{translation&&<p className="comic-translation">{c.ru}</p>}</div>;})}</div>
   <div className="comic-text-controls">{story.comic&&<button className="text-button" aria-pressed={motion} onClick={()=>setMotion(v=>!v)}>{motion?'Движение: вкл.':'Движение: выкл.'}</button>}<button className="text-button" disabled={!ready} onClick={()=>reveal()}><BookOpen size={16}/>{revealed?'Скрыть текст':'Открыть текст'}</button><button className="text-button" disabled={!ready} aria-expanded={translation} onClick={()=>reveal(true)}>{translation?'Скрыть перевод':'Перевод'}</button></div>
   </div>
  </section>
  {!finished&&node.choices.length>0&&<section className="comic-decisions"><h2>Твой ход!</h2><p>{canAdvance?(node.choices.every(choice=>hasRecordedClip(choice.clip))?'Послушай варианты, затем выбери ответ. Каждое решение меняет продолжение.':'Для ответа без записи открой текст по кнопке, затем выбери продолжение.'):'Послушай сцену или открой текст, чтобы выбрать ответ.'}</p><StoryChoices choices={node.choices} language={story.language} ready={ready} canAdvance={canAdvance} textOpen={choiceTexts} translationOpen={translation} playingChoice={playbackMode==='choice'?activeEntry?.choiceIndex??null:null} onListen={listenChoice} onChoose={choose} onReveal={revealChoice}/></section>}
  {!node.choices.length&&(canAdvance||finished)&&<section className="comic-ending"><span className="comic-kicker">ТВОЙ ФИНАЛ</span><h2>{node.outcome?.title}</h2><p>{node.outcome?.body}</p>{finished?<><p><Check size={16}/> История пройдена. Прослушано сцен: {progress.heard.length} из {route.length}. {progress.assisted.length?'Использовалась помощь текста.':'Текст реплик не открывался.'}</p><div className="character-dialogue-replay"><button className="button secondary" disabled={!ready||!fullPlaylist.length} onClick={()=>playbackMode==='dialogue'?cancel():void listen(fullPlaylist,'dialogue')}>{playbackMode==='dialogue'?<Square size={18}/>:<Play size={18}/>} {playbackMode==='dialogue'?'Остановить диалог':'Слушать весь диалог'}</button><p>Диалог прозвучит по твоему маршруту.</p>{missingAnswers>0&&<p>Ответов без аудиозаписи: {missingAnswers}. При воспроизведении они пропускаются; текст есть в твоём маршруте.</p>}</div><div className="section-actions">{next?<button className="button primary" disabled={!ready} onClick={()=>{cancel();onNext(next.id);}}>Следующая история · #{next.position}<ArrowRight size={18}/></button>:<button className="button primary" onClick={leave}>Ко всем историям</button>}<button className="button secondary" disabled={!ready} onClick={replay}>Другой путь</button></div></>:<button className="button primary" disabled={!ready} onClick={finish}>Завершить историю<Check size={18}/></button>}</section>}
  {finished&&exercises&&(progress.heard.includes(nodeId)?<StoryExercises key={exercises.releaseId+'-'+exercises.routeKey} exercises={exercises} progress={progress} ready={ready} playingQuestionId={playbackMode==='exercise'?playingQuestionId:null} evidenceAvailable={exerciseEvidenceAvailable} onAnswer={(questionId,answerIds)=>save(p=>answerExercise(exercises,p,questionId,answerIds))} onReplay={replayExercise} onStopReplay={cancel} onRestart={()=>save(p=>restartExercises(exercises,p))}/>:<section className="story-exercises-locked"><h2>Задания после истории</h2><p>Дослушай финальную сцену, чтобы открыть вопросы о событиях твоего маршрута.</p><button className="button secondary" disabled={!ready} onClick={()=>playbackMode==='scene'?cancel():void listen(scenePlaylist(story,nodeId),'scene')}>{playbackMode==='scene'?<Square size={17}/>:<Headphones size={17}/>} {playbackMode==='scene'?'Остановить финальную сцену':'Слушать финальную сцену'}</button></section>)}
  {finished&&exercises&&exerciseSummary(exercises,progress).completed&&<StorySpeakingPractice story={story} path={progress.path} ready={ready} listening={playbackMode==='speaking'} onListen={entry=>void listen([entry],'speaking')} onStop={cancel}/>}
  <EndingCollection story={story} progress={progress} current={nodeId}/><p className="comic-save-note" role="status">{profile.previewSaveNote||(profile.conflict?'Есть изменения на другом устройстве. Выбери версию прогресса выше.':profile.status==='synced'?'Прогресс сохранён в аккаунте':profile.status==='offline'?'Прогресс на устройстве. Синхронизация продолжится при подключении.':'Сохраняем твой маршрут…')}</p>
 </article>;
}

export function CourseProgress({profile,book}:{profile:Profile;book:Record<string,Progress>}){
 const [data,setData]=useState<StoryCatalog[]>([]),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();void Promise.all(['en','it'].map(language=>fetch('/api/stories?language='+language,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(setData).catch(()=>{if(!c.signal.aborted)setError(true);});return()=>c.abort();},[]);
 return <section className="comic-progress"><span className="comic-kicker">ТВОЙ ПУТЬ В ИСТОРИЯХ</span><h2>Каждый выбор — новый опыт.</h2>{error&&<p>Не удалось загрузить счётчики. Обнови страницу.</p>}<div className="comic-progress-grid">{data.map(c=>{const lang=c.items[0].language,done=c.items.filter(s=>storyFinished(s,profile.data.journey,book)).length;return <article key={lang}><h3>{languageNames[lang]}</h3><b>{done} / {c.total}</b><p>историй пройдено</p><progress aria-label={languageNames[lang]} max={c.total} value={done}/>{levels.map(l=><p key={l}>{l}: {c.items.filter(s=>s.level===l&&storyFinished(s,profile.data.journey,book)).length} / {c.counts[l]}</p>)}</article>;})}</div><p>Завершение истории означает, что ты дошёл до финала. Оно не является оценкой владения языком.</p></section>;
}
