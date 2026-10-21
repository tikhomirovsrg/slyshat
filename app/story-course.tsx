'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Headphones,Play,Square,BookOpen,Check} from 'lucide-react';
import type {Language} from './episodes';
import {languageNames} from './episodes';
import type {Progress} from './learning';
import type {Profile} from './use-profile';
import type {CourseStory,JourneyProgress,StoryCard,StoryCatalog} from '../lib/story-course-types';
import {legacyJourney,nextStory,resumeStory,storyFinished,storyRoute} from './story-course-state';
import {levels} from './study-types';
import {useSpeechPlayer} from './speech';
import StoryArt from './story-art';

type Props={language:Language;profile:Profile;book:Record<string,Progress>;speed:number;onLanguage:(lang:Language)=>void;initialStory?:string|null;onLeave?:()=>void};
const scrollTop=()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
const speaker=(voice:string)=>({bf_emma:'Эмма',bm_george:'Джордж',if_sara:'Сара',im_nicola:'Никола'}[voice]||'Персонаж');
export function StoryCourse({language,profile,book,speed,onLanguage,initialStory,onLeave}:Props){
 const [catalog,setCatalog]=useState<StoryCatalog|null>(null),[story,setStory]=useState<CourseStory|null>(null),[selected,setSelected]=useState(initialStory||''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [level,setLevel]=useState('all'),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[page,setPage]=useState(1);
 const {stop}=useSpeechPlayer();
 useEffect(()=>{if(initialStory)setSelected(initialStory);},[initialStory]);
 useEffect(()=>{const abort=new AbortController();setCatalog(null);setError('');void fetch('/api/stories?'+new URLSearchParams({language}),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Не удалось загрузить истории.');return r.json();}).then(data=>{if(!abort.signal.aborted)setCatalog(data);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[language,retry]);
 useEffect(()=>{setStory(null);if(!selected)return;const abort=new AbortController();setError('');void fetch('/api/stories?'+new URLSearchParams({id:selected}),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Не удалось открыть историю.');return r.json();}).then(data=>{if(!abort.signal.aborted)setStory(data);}).catch(e=>{if(!abort.signal.aborted)setError(e.message);});return()=>abort.abort();},[selected,retry]);
 const open=(id:string)=>{stop();setError('');setSelected(id);scrollTop();};
 const close=()=>{stop();setSelected('');onLeave?.();scrollTop();};
 const filtered=catalog?.items.filter(s=>(level==='all'||s.level===level)&&(!query.trim()||[s.title,s.topic,s.summary,String(s.position)].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))&&(status==='all'||(status==='done'?storyFinished(s,profile.data.journey,book):!storyFinished(s,profile.data.journey,book))))||[];
 const pages=Math.max(1,Math.ceil(filtered.length/12)),shownPage=Math.min(page,pages),resume=catalog&&resumeStory(catalog.items,profile.data.journey,book);
 const completed=catalog?.items.filter(s=>storyFinished(s,profile.data.journey,book)).length||0;
 return <main className="comic-page">
  {error&&<div className="warning" role="alert">{error} <button className="text-button" onClick={()=>setRetry(n=>n+1)}>Повторить</button></div>}
  {selected?story?<ComicStory key={story.id} story={story} profile={profile} old={book[story.id]} speed={speed} next={catalog?nextStory(catalog.items,story.id):null} onNext={open} onClose={close}/>:<section className="comic-loading"><button className="text-button" onClick={close}>← К историям</button><p role="status">{error?'История пока недоступна. Можно повторить загрузку.':'Открываем следующий кадр…'}</p></section>:<>
   <header className="comic-hero"><div><span className="comic-kicker">СЛУШАЙ. ВЫБИРАЙ. МЕНЯЙ ИСТОРИЮ.</span><h1>Твой ответ.<br/><em>Новый поворот!</em></h1><p>Живые диалоги в комиксах. Слушай персонажей и решай, что произойдёт дальше.</p><div className="language-tabs" role="group" aria-label="Язык историй">{(['en','it'] as Language[]).map(lang=><button key={lang} className={language===lang?'active':''} aria-pressed={language===lang} onClick={()=>onLanguage(lang)}>{languageNames[lang]}</button>)}</div></div><div className="comic-hero-art" aria-hidden="true"><StoryArt kind="coffee"/><span className="comic-sticker">А ЧТО,<br/>ЕСЛИ…?</span></div></header>
   <section className="comic-continue" aria-label="Прохождение по порядку"><div><span className="comic-kicker">ТВОЯ ЛИНИЯ СЮЖЕТА</span><h2>{resume?`Дальше: история ${resume.position}`:catalog?'Все истории пройдены!':'Собираем маршрут…'}</h2><p>{resume?`${resume.level} · ${resume.title}`:'Можно вернуться и выбрать другой финал.'}</p><small>{completed} из {catalog?.total??'…'} пройдено · A1 → A2 → B1 → B2 → C1</small></div>{resume&&<button className="button primary" disabled={!profile.ready||profile.conflict} onClick={()=>open(resume.id)}>{profile.data.journey?.stories[resume.id]||book[resume.id]?.started?'Продолжить':'Начать по порядку'}<ArrowRight size={19}/></button>}</section>
   <div className="comic-catalog-heading"><h2>Все истории</h2><p>Иди по порядку или выбирай любую.</p></div>
   <div className="catalog-filters"><label className="search-label">Найти историю<input type="search" placeholder="Название, тема или номер…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label><label>Сложность<select value={level} onChange={e=>{setLevel(e.target.value);setPage(1);}}><option value="all">Все уровни</option>{levels.map(l=><option key={l}>{l}</option>)}</select></label><label>Прохождение<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">Все истории</option><option value="new">Ещё не пройдены</option><option value="done">Пройдены</option></select></label></div>
   <p className="catalog-count" role="status">{catalog?`${filtered.length} из ${catalog.total} историй · по 200 на каждый уровень`:'Загружаем истории…'}</p>
   <div className="comic-grid">{filtered.slice((shownPage-1)*12,shownPage*12).map(s=>{const done=storyFinished(s,profile.data.journey,book),started=!!profile.data.journey?.stories[s.id]||book[s.id]?.started;return <article className="comic-card" key={s.id}><div className={'comic-card-art theme-'+s.art} aria-hidden="true"><StoryArt kind={s.art}/><span className="comic-number">#{String(s.position).padStart(3,'0')}</span></div><div className="comic-card-copy"><div className="comic-card-meta"><b>{s.level}</b><span>{done?'✓ Финал открыт':started?'В процессе':'Новая история'}</span></div><h3>{s.title}</h3><p>{s.summary}</p><button className="button primary" disabled={!profile.ready||profile.conflict} onClick={()=>open(s.id)}>{done?'Открыть комикс':started?'Продолжить':'Войти в историю'}<ArrowRight size={17}/></button></div></article>;})}</div>
   {catalog&&!filtered.length&&<p className="empty-catalog">Ничего не нашлось. Попробуй другой запрос или уровень.</p>}
   {catalog&&<nav className="comic-pagination" aria-label="Страницы историй"><button className="button secondary" disabled={shownPage<=1} onClick={()=>{setPage(shownPage-1);document.querySelector('.comic-catalog-heading')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>Назад</button><span>{shownPage} / {pages}</span><button className="button secondary" disabled={shownPage>=pages} onClick={()=>{setPage(shownPage+1);document.querySelector('.comic-catalog-heading')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}>Дальше</button></nav>}
   <details className="comic-about"><summary>Как устроены истории и уровни</summary><p>На каждом языке — 20 исходных историй и 980 интерактивных вариантов с развилками. Варианты развивают 25 ситуаций и используют общие сцены. Это практика разных решений в знакомом контексте. Уровни A1–C1 — учебный ориентир. Иллюстрации сцен повторяются, озвучка синтетическая, двумя голосами.</p></details>
  </>}
 </main>;
}

export function ComicStory({story,profile,old,speed,next,onNext,onClose}:{story:CourseStory;profile:Profile;old?:Progress;speed:number;next:StoryCard|null;onNext:(id:string)=>void;onClose:()=>void}){
 const progress=profile.data.journey?.stories[story.id]||legacyJourney(story,old),route=storyRoute(story,progress.path),nodeId=route.at(-1)!,node=story.nodes[nodeId];
 const [revealed,setRevealed]=useState(false),[translation,setTranslation]=useState(false),[playing,setPlaying]=useState(false),[clipIndex,setClipIndex]=useState(0);
 const {play,stop,error,state}=useSpeechPlayer();const run=useRef(0),opened=useRef(false);
 const ready=profile.ready&&!profile.conflict,canAdvance=progress.heard.includes(nodeId)||progress.assisted.includes(nodeId),finished=!!progress.finishedAt;
 const save=(fn:(p:JourneyProgress)=>JourneyProgress,complete=false)=>{
  if(!ready)return;profile.update(p=>{const journey=p.journey||{active:{},stories:{}},current=journey.stories[story.id]||legacyJourney(story,old),updated=fn(current);return {...p,journey:{active:{...journey.active,[story.language]:story.id},stories:{...journey.stories,[story.id]:updated}},...(complete&&!current.finishedAt&&updated.finishedAt?{events:[...p.events,{id:'story-finish:'+story.id+':'+updated.finishedAt,at:updated.finishedAt,points:2}].slice(-2000)}:{})};});
 };
 const cancel=()=>{run.current++;stop();setPlaying(false);};
 useEffect(()=>{if(ready&&!opened.current){opened.current=true;save(p=>({...p,updatedAt:new Date().toISOString()}));}},[ready]);
 useEffect(()=>{run.current++;stop();setPlaying(false);setRevealed(false);setTranslation(false);setClipIndex(0);return()=>{run.current++;stop();};},[story.id,nodeId,speed,stop]);
 const listen=async()=>{cancel();const token=run.current;setPlaying(true);
  for(let i=0;i<node.clips.length;i++){if(run.current!==token)return;const c=node.clips[i];setClipIndex(i);const done=await play('comic-'+story.id+'-'+nodeId+'-'+i,{text:c.text,source:c.source,startAt:c.startAt,endAt:c.endAt,locale:story.language==='it'?'it-IT':'en-GB',speed,onCancel:()=>{if(run.current===token){run.current++;setPlaying(false);}}});if(run.current!==token)return;if(!done){setPlaying(false);return;}}
  setPlaying(false);save(p=>storyRoute(story,p.path).at(-1)===nodeId?{...p,heard:[...new Set([...p.heard,nodeId])],updatedAt:new Date().toISOString()}:p);
 };
 const reveal=(ru=false)=>{if(!finished)save(p=>({...p,assisted:[...new Set([...p.assisted,nodeId])],updatedAt:new Date().toISOString()}));if(ru)setTranslation(v=>!v);else setRevealed(v=>!v);};
 const choose=(index:number)=>{if(!canAdvance||!ready||finished)return;cancel();save(p=>storyRoute(story,p.path).at(-1)===nodeId?{...p,path:[...p.path,index],updatedAt:new Date().toISOString()}:p);scrollTop();};
 const finish=()=>{if(node.choices.length||!canAdvance||finished)return;cancel();save(p=>({...p,finishedAt:new Date().toISOString(),completedAt:p.completedAt||new Date().toISOString(),endings:[...new Set([...(p.endings||[]),nodeId])],updatedAt:new Date().toISOString()}),true);};
 const replay=()=>{cancel();save(p=>({path:[],heard:[],assisted:[],finishedAt:null,completedAt:p.completedAt||p.finishedAt||undefined,endings:p.endings||(p.finishedAt?[nodeId]:[]),updatedAt:new Date().toISOString()}));};
 return <article className="comic-story">
  <div className="comic-story-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={16}/> Все истории</button><span>#{story.position} · {story.level} · {languageNames[story.language]}</span><label>Скорость <span>{speed}×</span></label></div>
  <header className="comic-story-title"><span className="comic-kicker">ТЫ ВЛИЯЕШЬ НА СЮЖЕТ</span><h1>{story.title}</h1><p>{story.context}</p></header>
  {route.length>1&&<details className="comic-route"><summary>Твой маршрут · выбрано реплик: {progress.path.length}</summary><ol>{progress.path.map((index,i)=><li key={i}><span>Кадр {i+1}</span><p lang={story.language}>{story.nodes[route[i]].choices[index].text}</p><small>{story.nodes[route[i]].choices[index].label}</small></li>)}</ol></details>}
  <section className="comic-scene" aria-label={'Кадр '+route.length}>
   <div className="comic-scene-art" aria-hidden="true"><StoryArt kind={story.art}/><span className="comic-number">КАДР {route.length}</span><span className="comic-scene-tag">{node.choices.length?'ЧТО ТЫ ВЫБЕРЕШЬ?':'РАЗВЯЗКА!'}</span></div>
   <div className="comic-dialogue"><div className="comic-audio-controls"><button className="button primary" disabled={!ready} onClick={()=>playing?cancel():void listen()}>{playing?<Square size={18}/>:<Play size={18}/>} {playing?(state?.phase==='loading'?'Загружаем звук…':'Остановить'):'Слушать сцену'}</button><span role="status">{playing?`Реплика ${clipIndex+1} из ${node.clips.length}`:progress.heard.includes(nodeId)?'✓ Сцена прослушана':'Готовая запись · слушай в своём темпе'}</span></div>
   {error&&<p className="warning" role="alert">{error} Можно повторить или открыть текст.</p>}
   <div className="comic-bubbles">{node.clips.map((c,i)=><div key={i} className={'comic-bubble '+(i%2?'reply':'')+(playing&&clipIndex===i?' speaking':'')}><b>Голос: {speaker(c.voice)}</b>{revealed?<p lang={story.language}>{c.text}</p>:<p className="comic-hidden"><Headphones size={20}/><span>{playing&&clipIndex===i?'Персонаж говорит…':'Реплика звучит в аудио'}</span></p>}{translation&&<p className="comic-translation">{c.ru}</p>}</div>)}</div>
   <div className="comic-text-controls"><button className="text-button" disabled={!ready} onClick={()=>reveal()}><BookOpen size={16}/>{revealed?'Скрыть текст':'Открыть текст'}</button><button className="text-button" disabled={!ready} onClick={()=>reveal(true)}>{translation?'Скрыть перевод':'Перевод'}</button></div>
   </div>
  </section>
  {!finished&&node.choices.length>0&&<section className="comic-decisions"><h2>Твой ход!</h2><p>{canAdvance?'Выбери реплику. Каждое решение меняет продолжение.':'Послушай сцену или открой текст, чтобы выбрать ответ.'}</p><div>{node.choices.map((choice,i)=><button className="comic-choice" key={i} disabled={!ready||!canAdvance} onClick={()=>choose(i)}><span className="comic-choice-letter">{String.fromCharCode(65+i)}</span><span><strong lang={story.language}>{choice.text}</strong>{translation&&<small>{choice.label}</small>}</span><ArrowRight size={20}/></button>)}</div></section>}
  {!node.choices.length&&(canAdvance||finished)&&<section className="comic-ending"><span className="comic-kicker">ТВОЙ ФИНАЛ</span><h2>{node.outcome?.title}</h2><p>{node.outcome?.body}</p>{finished?<><p><Check size={16}/> История пройдена. Прослушано сцен: {progress.heard.length} из {route.length}. {progress.assisted.length?'Использовалась помощь текста.':'Текст реплик не открывался.'}</p><div className="section-actions">{next?<button className="button primary" disabled={!ready} onClick={()=>onNext(next.id)}>Следующая история · #{next.position}<ArrowRight size={18}/></button>:<button className="button primary" onClick={onClose}>Ко всем историям</button>}<button className="button secondary" disabled={!ready} onClick={replay}>Другой путь</button></div></>:<button className="button primary" disabled={!ready} onClick={finish}>Завершить историю<Check size={18}/></button>}</section>}
  <p className="comic-save-note" role="status">{profile.conflict?'Есть изменения на другом устройстве. Выбери версию прогресса выше.':profile.status==='synced'?'Прогресс сохранён в аккаунте':profile.status==='offline'?'Прогресс на устройстве. Синхронизация продолжится при подключении.':'Сохраняем твой маршрут…'}</p>
 </article>;
}

export function CourseProgress({profile,book}:{profile:Profile;book:Record<string,Progress>}){
 const [data,setData]=useState<StoryCatalog[]>([]),[error,setError]=useState(false);
 useEffect(()=>{const c=new AbortController();void Promise.all(['en','it'].map(language=>fetch('/api/stories?language='+language,{signal:c.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(setData).catch(()=>{if(!c.signal.aborted)setError(true);});return()=>c.abort();},[]);
 return <section className="comic-progress"><span className="comic-kicker">ТВОЙ ПУТЬ В ИСТОРИЯХ</span><h2>Каждый выбор — новый опыт.</h2>{error&&<p>Не удалось загрузить счётчики. Обнови страницу.</p>}<div className="comic-progress-grid">{data.map(c=>{const lang=c.items[0].language,done=c.items.filter(s=>storyFinished(s,profile.data.journey,book)).length;return <article key={lang}><h3>{languageNames[lang]}</h3><b>{done} / {c.total}</b><p>историй пройдено</p><progress aria-label={languageNames[lang]} max={c.total} value={done}/>{levels.map(l=><p key={l}>{l}: {c.items.filter(s=>s.level===l&&storyFinished(s,profile.data.journey,book)).length} / {c.counts[l]}</p>)}</article>;})}</div><p>Завершение истории означает, что ты дошёл до финала. Оно не является оценкой владения языком.</p></section>;
}
