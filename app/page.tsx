'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowLeft,Headphones,Bookmark,BarChart3,Play,Square,Check,Volume2,Settings2,X,RotateCcw,Download,Upload,Clock3,MapPin,MessageCircle,BookOpen,AlertCircle,ChevronRight} from 'lucide-react';
import {episodes,getEpisode,languageNames,speakerNames,type Episode,type Phrase,type Language} from './episodes';
import StoryArt from './story-art';
import {fresh,validateCollection,resultFor,phases,type Progress,type Phase} from './learning';

import {useStudyProgress} from './use-study-progress';
import {useProfile} from './use-profile';
import {PracticePanel} from './practice-panel';
import {StudyDashboard} from './study-dashboard';
import {MaterialLibrary,WordLibrary} from './study-library';
import {StoryCourse,CourseProgress} from './story-course';
import {playbackSpeeds,speedLabel} from '../lib/playback-speed';
import {SpeechProvider,SpeechLabel,useSpeechPlayer,useSpeechConfig} from './speech';
import {neuralVoices,defaultVoice} from '../lib/speech-config';
import {getPack} from './packs';
import {lessonScore} from './study';
import {levels} from './study-types';
import {AccountPanel,LoginScreen,RunHistory,syncLabels} from './account-panel';
import {StoryPreview} from './story-preview';
import {previewOptions,type PreviewOptions} from '../lib/preview-options';

const phaseNames=['Ситуация','Слушаем','Разбираем','Разговор','Новая ситуация','Результат'];

export default function Home(){
 const [mode,setMode]=useState<PreviewOptions|false|null>(null);
 useEffect(()=>{setMode(previewOptions(window.location.search)||false);},[]);
 if(mode===null)return <main className="loading">Открываем истории…</main>;
 return <SpeechProvider>{mode?<StoryPreview options={mode}/>:<LearningHome/>}</SpeechProvider>;
}
function LearningHome(){
 const sync=useStudyProgress();
 const profile=useProfile(sync.account?.id);
 const {p,setP,book,loaded}=sync;
 const episode=getEpisode(p.episode);
 const nodes=episode.nodes;
 const [view,setView]=useState<'scene'|'phrases'|'progress'|'day'|'grammar'|'reading'|'audio'>('scene');
 const [courseTarget,setCourseTarget]=useState<string|null>(null);
 const [courseReset,setCourseReset]=useState(0);
 const [settings,setSettings]=useState(false);
 const [cover,setCover]=useState(true);
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('all');
 const [levelFilter,setLevelFilter]=useState('all');
 const [catalogStatus,setCatalogStatus]=useState('all');
 const [hideStudy,setHideStudy]=useState(false);
 useEffect(()=>{setHideStudy(false);setEnglishChoices(false);},[p.episode,p.phraseIndex]);
 const {config:audioConfig,voices:allVoices}=useSpeechConfig();
 const voices=allVoices.filter(v=>v.lang.toLowerCase().startsWith(episode.language));
 const audioPlayer=useSpeechPlayer();
 const {play:playAudio,stop,error:audioError}=audioPlayer;
 const playing=audioPlayer.state?.phase==='playing'?audioPlayer.state.id:null;
 const pending=audioPlayer.state?.phase==='loading'?audioPlayer.state.id:null;
 const supported=true;
 const [notice,setNotice]=useState('');
 const [englishChoices,setEnglishChoices]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null);
 const modalRef=useRef<HTMLDivElement>(null);
 const settingsOpener=useRef<HTMLElement|null>(null);

 useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>{if(!settings)return;settingsOpener.current=document.activeElement as HTMLElement;const old=document.body.style.overflow;document.body.style.overflow='hidden';modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setSettings(false);if(e.key==='Tab'){const all=modalRef.current?.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]');if(!all?.length)return;const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',key);settingsOpener.current?.focus();};
 },[settings]);
 useEffect(()=>{stop();},[p.episode,p.phase,p.node,p.phraseIndex,p.transferIndex,view,settings,stop]);
 const assistance=useCallback((id:string,kind:'play'|'text'|'translation')=>setP(s=>{const a=s.attempts[id]||{plays:0,text:false,translation:false};return {...s,attempts:{...s.attempts,[id]:{plays:a.plays+(kind==='play'?1:0),text:a.text||kind==='text',translation:a.translation||kind==='translation'}}};}),[]);
 const speak=useCallback((text:string,id:string,speaker=episode.mainSpeaker.id,speed?:number)=>{
  const secondary=speaker===episode.secondSpeaker.id;
  void playAudio(id,{text,locale:episode.locale,voice:secondary?p.voiceOliver:p.voiceMaya,secondary,speed:speed??p.speed,onEnd:()=>assistance(id,'play')});
 },[p.speed,p.voiceMaya,p.voiceOliver,playAudio,assistance,episode]);
 const phase=(next:Phase)=>{stop();setP(s=>({...s,phase:next,started:true}));window.scrollTo({top:0,behavior:'smooth'});};
 const start=()=>{setCover(false);setP(s=>({...s,started:true}));setView('scene');};
 const toggleSaved=(id:string)=>setP(s=>({...s,saved:s.saved.includes(id)?s.saved.filter(x=>x!==id):[...s.saved,id]}));
 const navigate=(next:typeof view)=>{stop();setCourseTarget(null);if(next==='scene')setCourseReset(n=>n+1);setCover(false);setView(next);window.scrollTo({top:0,behavior:'smooth'});};
 const reset=()=>{if(p.finishedAt&&sync.status!=='synced'){setNotice('Сначала дождись сохранения завершённой попытки в аккаунте.');return;}if(!window.confirm('Начать эпизод заново? Результаты этой попытки будут сброшены. Сохранённые фразы и настройки останутся.'))return;stop();setP(s=>({...fresh(s.episode),saved:s.saved,speed:s.speed,voiceMaya:s.voiceMaya,voiceOliver:s.voiceOliver,practice:s.practice}));setView('scene');setCover(false);setNotice('Можно пройти историю другим путём.');};
 const exportProgress=()=>{const blob=new Blob([JSON.stringify({kind:'slyshat-collection',version:2,active:p.episode,progress:{...book,[p.episode]:p},studyProfile:profile.data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='slyshat-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const importProgress=async(file:File)=>{try{if(file.size>4000000)throw new Error('Файл слишком большой. Выбери экспорт прогресса этого приложения.');const value=validateCollection(JSON.parse(await file.text()));if(!window.confirm('Заменить текущий прогресс данными из файла?'))return;stop();sync.importRecords(value.progress,value.active);if(value.studyProfile)profile.update(()=>value.studyProfile!);setView('scene');setCover(true);setNotice('Прогресс историй восстановлен.');}catch(e){setNotice(e instanceof Error?e.message:'Не удалось прочитать файл.');}};
 const selectEpisode=(id:string,openLesson=true)=>{stop();setCourseTarget(openLesson?id:null);sync.select(id,openLesson);setCover(!openLesson);setView('scene');window.scrollTo({top:0,behavior:'smooth'});};
 const changeLanguage=(lang:Language)=>{setSearch('');setCategory('all');setLevelFilter('all');setCatalogStatus('all');const target=episodes.find(e=>e.language===lang&&!book[e.id]?.finishedAt)||episodes.find(e=>e.language===lang)!;selectEpisode(target.id,false);};
 const canAnswer=(id:string)=>!!p.attempts[id]?.plays||!!p.attempts[id]?.text||!!p.attempts[id]?.translation;
 const completed=Object.values(p.results);
 const correct=completed.filter(r=>r.correct).length;
 const independent=completed.filter(r=>r.correct&&r.withoutText).length;
 const phaseIndex=phases.indexOf(p.phase);
 const playerProps={playing,pending,speak,stop,assistance,p,supported};
 const current=nodes[p.node];
 const languageEpisodes=episodes.filter(e=>e.language===episode.language);
 const categories=[...new Set(languageEpisodes.map(e=>e.category))];
 const visibleEpisodes=languageEpisodes.filter(e=>{const saved=book[e.id];const matchStatus=catalogStatus==='all'||(catalogStatus==='done'?!!saved?.finishedAt:catalogStatus==='started'?saved?.started&&!saved?.finishedAt:!saved?.started);return matchStatus&&(levelFilter==='all'||getPack(e.id)?.level===levelFilter)&&(category==='all'||e.category===category)&&(!search.trim()||[e.title,e.summary,e.category,e.mainSpeaker.name].join(' ').toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));});

 return <div className="app-shell">
  <header className="topbar">
   <button className="brand" onClick={()=>{navigate('scene');setCover(true);}} aria-label="Слышать, главная"><span className="brand-symbol"><i/><i/><i/><i/><i/></span><span>слышать<span className="brand-dot">.</span></span></button>
   <nav aria-label="Основная навигация">{[{id:'scene',label:'Истории',Icon:Headphones},{id:'day',label:'Мой день',Icon:Clock3},{id:'reading',label:'Чтение',Icon:BookOpen},{id:'grammar',label:'Грамматика',Icon:MessageCircle},{id:'phrases',label:'Словарь',Icon:Bookmark},{id:'progress',label:'Прогресс',Icon:BarChart3}].map(({id,label,Icon})=><button key={id} className={view===id?'nav-item active':'nav-item'} aria-current={view===id?'page':undefined} onClick={()=>{navigate(id as typeof view);if(id==='scene')setCover(true);}}><Icon size={17}/><span>{label}</span>{id==='phrases'&&p.saved.length>0&&<small>{p.saved.length}</small>}</button>)}</nav>
   <div className="header-actions"><label className="sr-only" htmlFor="study-language">Язык изучения</label><select id="study-language" className="language-select" disabled={!loaded||!sync.account} value={episode.language} onChange={e=>changeLanguage(e.target.value as Language)}><option value="en">EN · Английский</option><option value="it">IT · Итальянский</option></select><button className="icon-button settings-trigger" disabled={!sync.account} onClick={()=>setSettings(true)} title="Настройки звука и данных" aria-label="Настройки звука и данных"><Settings2 size={20}/></button></div>
  </header>
  {!loaded?<main className="loading">Открываем твою историю…</main>:(!sync.account||sync.status==='signin')?<LoginScreen sync={sync}/>:<>
  <AccountPanel sync={sync} compact/>
  {profile.conflict&&<div className="profile-sync-note"><b>Настройки и тесты изменились на другом устройстве.</b><p>Выбери версию учебного профиля. Прогресс историй синхронизируется отдельно.</p><button className="button secondary small-button" onClick={()=>profile.resolve(true)}>С этого устройства</button> <button className="button secondary small-button" onClick={()=>profile.resolve(false)}>С сервера</button></div>}
  {profile.ready&&profile.status!=='synced'&&!profile.conflict&&<div className="profile-sync-note" role="status">Учебный профиль: {syncLabels[profile.status]}. <button className="text-button" onClick={()=>void profile.refresh()}>Обновить</button></div>}
  {view==='day'&&<StudyDashboard language={episode.language} book={book} profile={profile} onSelect={id=>{stop();setCourseTarget(id);setView('scene');}}/>}
  {(view==='reading'||view==='grammar')&&<MaterialLibrary key={episode.language+view} kind={view} language={episode.language} p={p} book={book} onSelect={id=>sync.select(id)} onChange={setP} onActivity={profile.event}/>}

  {view==='phrases'&&<WordLibrary key={episode.language} language={episode.language} book={book} update={sync.updateEpisode} speak={speak} onActivity={profile.event}/>}
  {view==='scene'&&<StoryCourse key={(sync.account?.id||'')+episode.language+courseReset} language={episode.language} profile={profile} book={book} speed={p.speed} onSpeed={speed=>setP(s=>({...s,speed}))} onLanguage={changeLanguage} initialStory={courseTarget} onLeave={()=>setCourseTarget(null)}/>}
  {view==='progress'&&<main className="progress-page"><CourseProgress profile={profile} book={book}/><details className="legacy-results"><summary>Архив заданий и письменных работ</summary><div className="eyebrow">ТВОЙ ПРОГРЕСС</div><h1>Слышать становится<br/><em>чуть легче.</em></h1><p className="section-intro">Ранние учебные блоки: завершено {Object.values(book).filter(x=>x.finishedAt).length} из {episodes.length}. Сохранено {Object.values(book).reduce((n,x)=>n+x.saved.length,0)} фраз.<br/>Ниже — результат выбранной истории; подсказки учитываются отдельно.</p><p className="helper">Сохранены результаты прежней аудиопрактики: {Object.keys(profile.data.audioPractice||{}).length}. Они остаются в аккаунте и резервной копии.</p><EpisodeSelector episode={episode} onSelect={id=>{selectEpisode(id,false);setView('progress');}}/><div className="results-grid"><div><strong>{completed.length}<span>/3</span></strong><p>новых ситуаций<br/>проверено</p></div><div><strong>{independent}</strong><p>понято верно<br/>без текста</p></div><div><strong>{p.saved.length}</strong><p>фраз в личной<br/>подборке</p></div></div><section className="progress-detail"><div className="title-row"><h3>{episode.title}</h3><span className="pill">{p.finishedAt?'Пройдено':p.started?'В процессе':'Ещё не начато'}</span></div><div className="progress-track"><span style={{width:`${p.finishedAt?100:p.started?Math.max(5,phaseIndex/5*100):0}%`}}/></div><p>{p.started?phaseNames[phaseIndex]:'Этот эпизод ждёт тебя.'}</p><button className="button primary" onClick={()=>{if(!p.started)start();else navigate('scene');}}>{p.finishedAt?'Посмотреть результат':'Продолжить историю'}<ArrowRight size={16}/></button></section><div className="attempts-list">{episode.transfer.map(t=>{const r=p.results[t.id];return <div key={t.id}><span>{t.question}</span><b>{!r?'Ещё впереди':r.correct?r.withoutText?'Верно, без текста':'Верно, с текстом':'Нужен повтор'}</b></div>;})}</div><p className="quiet-note">Это результаты трёх заданий, а не оценка уровня CEFR. После синхронизации они доступны на других устройствах.</p><div className="mastery-note">{lessonScore(episode,p).mastered?'Урок освоен':'Учебный блок ещё не завершён'} · {lessonScore(episode,p).percent}% заданий. Для освоения нужны минимум 80% и письменная самопроверка.</div><PracticePanel key={episode.id} episode={episode} p={p} onChange={setP} onActivity={profile.event}/><RunHistory sync={sync} episode={p.episode}/><button className="text-button" onClick={exportProgress}><Download size={16}/> Скачать прогресс</button></details></main>}
  </>}
  <footer className="site-footer"><span>слышать. <span className="muted">Истории, практика и свой темп.</span></span><span>КОМИКСЫ · 2 ЯЗЫКА <span className="footer-dot">·</span> ТВОЙ ВЫБОР МЕНЯЕТ СЮЖЕТ</span></footer>
  {notice&&<div className="toast" role="status">{notice}<button aria-label="Закрыть сообщение" onClick={()=>setNotice('')}><X size={16}/></button></div>}
  {settings&&<div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setSettings(false);}}><div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="title-row"><h2 id="settings-title">Звук и прогресс</h2><button className="icon-button" aria-label="Закрыть настройки" onClick={()=>setSettings(false)}><X size={20}/></button></div><p>В комиксах звучат готовые записи двух персонажей: Эмма и Джордж на английском, Сара и Никола на итальянском. Скорость меняется прямо в сцене или ниже в настройках.</p><details className="extra-voices"><summary>Озвучка словаря и дополнительных материалов</summary><p>{audioConfig.message}</p><p className="helper">Выбери разные голоса участников и сравни образцы. Выбор сохраняется для этой истории в твоём аккаунте. Нейроголоса — синтез речи, а не записи дикторов.</p>{([episode.mainSpeaker.id,episode.secondSpeaker.id]).map((name,i)=>{const saved=i===0?p.voiceMaya:p.voiceOliver;const value=saved.startsWith('cloud:')||saved.startsWith('device:')?saved:audioConfig.provider==='google'?'':saved?'device:'+saved:'';return <div className="voice-control" key={name}><label htmlFor={'voice-'+name}>{i===0?episode.mainSpeaker.name+' — основной участник':episode.secondSpeaker.name+' / твои ответы — второй голос'}</label><select id={'voice-'+name} value={value} onChange={e=>{stop();setP(s=>({...s,[i===0?'voiceMaya':'voiceOliver']:e.target.value}));}}><option value="">{audioConfig.provider==='google'?'Нейроголос по умолчанию · '+neuralVoices.find(v=>v.id===defaultVoice(i===1))!.name:'Системный голос по умолчанию'}</option><optgroup label="Нейроголоса · Google Chirp 3 HD">{neuralVoices.map(v=><option key={v.id} value={'cloud:'+v.id} disabled={audioConfig.provider!=='google'}>{v.label}{audioConfig.provider!=='google'?' · ещё не подключён':''}</option>)}</optgroup><optgroup label="Системные голоса устройства"><option value="device:">Системный · автоматически</option>{voices.map(v=><option key={v.voiceURI} value={'device:'+v.voiceURI}>{v.name} · {v.lang}</option>)}{value.startsWith('device:')&&value!=='device:'&&!voices.some(v=>'device:'+v.voiceURI===value)&&<option value={value}>Сохранённый голос недоступен на этом устройстве</option>}</optgroup></select><button className="text-button" onClick={()=>playing==='voice-test-'+name||pending==='voice-test-'+name?stop():speak(episode.checkText,'voice-test-'+name,name)}><Play size={14}/>{pending==='voice-test-'+name?'Готовим запись… · остановить':playing==='voice-test-'+name?'Остановить образец':'Послушать голос'}</button></div>;})}{audioError&&<p className="warning" role="alert">{audioError}</p>}</details><div className="voice-control"><label htmlFor="global-speed">Скорость диалогов</label><select id="global-speed" value={p.speed} onChange={e=>{stop();setP(s=>({...s,speed:Number(e.target.value)}));}}>{playbackSpeeds.map(n=><option key={n} value={n}>{speedLabel(n)}</option>)}</select></div><div className="settings-divider"/><h3>Резервная копия прогресса</h3><p>Сохранения синхронизируются с твоим аккаунтом Яндекса. Здесь можно загрузить прогресс со старого сайта или скачать дополнительную копию.</p><div className="data-actions"><button className="button secondary" onClick={exportProgress}><Download size={16}/> Скачать</button><button className="button secondary" onClick={()=>fileRef.current?.click()}><Upload size={16}/> Загрузить</button></div><input hidden ref={fileRef} type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];if(f)void importProgress(f);e.target.value='';}}/><p className="storage-label">{syncLabels[sync.status]}</p><p className="helper">Чтобы вернуться к первому кадру, нажми «С начала» в открытой истории. Пройденные финалы сохранятся.</p></div></div>}
 </div>;
}

type PlayerProps={id:string;text:string;ru:string;speaker:string;playing:string|null;pending:string|null;p:Progress;supported:boolean;speak:(text:string,id:string,speaker?:string,speed?:number)=>void;stop:()=>void;assistance:(id:string,kind:'play'|'text'|'translation')=>void};
function Player({id,text,ru,speaker,playing,pending,p,supported,speak,stop,assistance}:PlayerProps){
 const episode=getEpisode(p.episode);
 const [showText,setShowText]=useState(false);const [showRu,setShowRu]=useState(false);const [showParts,setShowParts]=useState(false);const [loop,setLoop]=useState(false);const [speed,setSpeed]=useState(p.speed);const [part,setPart]=useState(0);
 const parts=text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(s=>s.trim())||[text];
 const active=playing===id;const waiting=pending===id;const count=p.attempts[id]?.plays||0;
 const previousCount=useRef(count);const loopTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const play=()=>speak(showParts?parts[part]:text,id,speaker,speed);
 useEffect(()=>{if(count>previousCount.current&&!active&&loop){loopTimer.current=setTimeout(()=>speak(showParts?parts[part]:text,id,speaker,speed),700);}previousCount.current=count;return()=>{if(loopTimer.current)clearTimeout(loopTimer.current);};},[active,loop,count,showParts,parts.join('|'),part,text,id,speaker,speed,speak]);
 const pause=()=>{setLoop(false);if(loopTimer.current)clearTimeout(loopTimer.current);stop();};
 const reveal=()=>{setShowText(!showText);if(!showText)assistance(id,'text');};
 return <div className={'audio-card '+(active?'is-playing':'')}><div className="audio-top"><div className="speaker"><span className={'avatar '+(speaker===episode.secondSpeaker.id?'oliver':'')}>{speaker[0]}</span><div><b>{speakerNames[speaker]||speaker}</b><span>{showParts?`Фрагмент ${part+1} из ${parts.length}`:'Голосовое сообщение'}</span></div></div><span className="audio-badge"><span/> <SpeechLabel voice={speaker===episode.secondSpeaker.id?p.voiceOliver:p.voiceMaya}/></span></div><div className="audio-main"><button className="play-button" disabled={!supported} aria-label={active||waiting?'Остановить воспроизведение':'Воспроизвести сообщение'} onClick={()=>{if(active||waiting)pause();else play();}}>{active||waiting?<Square size={20} fill="currentColor"/>:<Play size={24} fill="currentColor"/>}</button><div className={'waveform '+(active?'animate':'')} aria-hidden="true">{Array.from({length:47},(_,i)=><i key={i} style={{height:`${12+((i*17+7)%37)}px`,animationDelay:`${i%9*.09}s`}}/>)}</div><span className="play-label" aria-live="polite">{waiting?'Запуск…':active?'Слушаем':count>0?'Ещё раз':'Слушать'}</span></div><div className="audio-controls"><div className="speed-control" role="group" aria-label="Скорость воспроизведения">{[0.75,0.9,1,1.1].map(n=><button key={n} aria-pressed={speed===n} className={speed===n?'active':''} onClick={()=>{pause();setSpeed(n);}}>{n}×</button>)}</div><div className="fragment-actions"><button className={loop?'active':''} aria-pressed={loop} onClick={()=>{setLoop(!loop);if(!loop&&!active)play();}} title="Повторять с паузой"><RotateCcw size={15}/><span>Цикл</span></button>{parts.length>1&&<button className={showParts?'active':''} aria-pressed={showParts} onClick={()=>{pause();setShowParts(!showParts);setPart(0);}}>По фрагментам</button>}</div></div>{showParts&&<div className="fragment-picker">{parts.map((_,i)=><button key={i} className={part===i?'active':''} onClick={()=>{pause();setPart(i);speak(parts[i],id,speaker,speed);}}>Фрагмент {i+1}</button>)}</div>}<div className="transcript-controls"><button onClick={reveal}><BookOpen size={15}/>{showText?'Скрыть текст':'Не расслышал · показать текст'}</button><button onClick={()=>{setShowRu(!showRu);if(!showRu)assistance(id,'translation');}}>{showRu?'Скрыть перевод':'Перевод'}</button></div>{showText&&<div className="transcript" lang={episode.language}>{showParts?parts[part]:text}</div>}{showRu&&<div className="translation">{ru}</div>}{!supported&&<p className="helper">Озвучка недоступна в этом браузере. Можно открыть текст, но это не будет считаться аудированием.</p>}</div>;
}

function PhraseCard({episode,phrase:f,saved,onSave,speak,playing}:{episode:Episode;phrase:Phrase;saved:boolean;onSave:()=>void;speak:PlayerProps['speak'];playing:string|null}){
 const [open,setOpen]=useState(false);
 return <article className="phrase-card"><div className="phrase-card-top"><span className="eyebrow">{languageNames[episode.language].toUpperCase()} · {episode.number}</span><button className={'bookmark-button '+(saved?'saved':'')} aria-label={saved?'Убрать из моих фраз':'Сохранить фразу'} aria-pressed={saved} onClick={onSave}><Bookmark size={19} fill={saved?'currentColor':'none'}/></button></div><h3 lang={episode.language}>{f.text}</h3><p className="phrase-translation">{f.ru}</p><div className="phrase-buttons"><button onClick={()=>speak(f.text,'phrase-'+f.id)}><Play size={15}/>{playing==='phrase-'+f.id?'Звучит…':'Послушать'}</button><button onClick={()=>speak(f.part,'phrase-part-'+f.id,episode.mainSpeaker.id,.9)}>Ключевой фрагмент</button></div><button className="explain-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Скрыть разбор':'Почему это так звучит?'}<ChevronRight size={15} style={{transform:open?'rotate(90deg)':''}}/></button>{open&&<div className="phrase-explanation"><p>{f.why}</p><p><b>На что обратить внимание:</b> {f.sound}</p><div className="another-example"><span className="eyebrow">В ДРУГОЙ СИТУАЦИИ</span><button onClick={()=>speak(f.example,'example-'+f.id)}><Volume2 size={16}/><span lang={episode.language}>{f.example}</span></button><small>{f.exampleRu}</small></div></div>}</article>;
}

function EpisodeSelector({episode,onSelect}:{episode:Episode;onSelect:(id:string)=>void}){return <label className="episode-selector">История<select value={episode.id} onChange={e=>onSelect(e.target.value)}>{episodes.map(e=><option key={e.id} value={e.id}>{languageNames[e.language]} · {e.title}</option>)}</select></label>;}
