'use client';
import {useEffect,useRef,useState} from 'react';
import {useSpeechPlayer} from './speech';
import {levels} from './study-types';
import type {Language} from './episodes';
import type {AudioCatalog,AudioStory} from '../lib/audio-library-types';
import type {Profile} from './use-profile';

const voiceNames:Record<string,string>={bf_emma:'Emma',bm_george:'George',if_sara:'Sara',im_nicola:'Nicola'};
const minutes=(n:number)=>{const seconds=Math.round(n);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
export function AudioLibrary({language,speed,profile}:{language:Language;speed:number;profile:Profile}){
 const [level,setLevel]=useState<string>(profile.data.levels[language]),[topic,setTopic]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const [catalog,setCatalog]=useState<AudioCatalog|null>(null),[selected,setSelected]=useState(''),[story,setStory]=useState<AudioStory|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  const timer=setTimeout(()=>void fetch('/api/audio/library?'+new URLSearchParams({language,level,topic,q:query,page:String(page)}),{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Не удалось загрузить каталог.');return r.json();}).then(data=>{if(!controller.signal.aborted){setCatalog(data);setLoading(false);}}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}}),180);
  return()=>{clearTimeout(timer);controller.abort();};
 },[language,level,topic,query,page,retry]);
 useEffect(()=>{
  if(!selected){setStory(null);return;}
  const controller=new AbortController();setStory(null);setError('');
  void fetch('/api/audio/library?'+new URLSearchParams({id:selected}),{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Не удалось открыть историю.');return r.json();}).then(data=>{if(!controller.signal.aborted)setStory(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  return()=>controller.abort();
 },[selected,retry]);
 const filter=(fn:()=>void)=>{fn();setPage(1);setSelected('');};
 return <section className="audio-library" aria-labelledby="audio-library-title">
  <div className="eyebrow">БИБЛИОТЕКА АУДИОИСТОРИЙ</div><h2 id="audio-library-title">Истории под твой уровень.</h2>
  <p>25 ситуаций, 8 сюжетных поворотов и 5 уровней — 1000 сценарных вариантов на язык. Общие сцены повторяются для закрепления. Готовые синтетические записи Kokoro: два голоса на язык, без ключа API.</p>
  <p className="helper">Проверено в аккаунте: {Object.keys(profile.data.audioPractice||{}).filter(id=>id.startsWith(language+'-')).length} из 1000 вариантов.</p>
  <div className="catalog-filters">
   <label>Сложность<select value={level} onChange={e=>filter(()=>setLevel(e.target.value))}><option value="all">Все уровни</option>{levels.map(l=><option key={l} value={l}>{l}{catalog?` · ${catalog.counts[l]} с аудио`:''}</option>)}</select></label>
   <label>Тема<select value={topic} onChange={e=>filter(()=>setTopic(e.target.value))}><option value="">Все ситуации</option>{catalog?.topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <label className="search-label">Поиск<input type="search" value={query} placeholder="Встреча, работа, поездка…" onChange={e=>filter(()=>setQuery(e.target.value))}/></label>
  </div>
  {catalog&&level!=='all'&&<p className="audio-level-note"><strong>{level} · {catalog.levels[level as keyof typeof catalog.levels].label}.</strong> {catalog.levels[level as keyof typeof catalog.levels].focus}. {catalog.levels[level as keyof typeof catalog.levels].grammar}.</p>}
  <p className="helper">Уровни — учебный ориентир, без внешней экспертизы CEFR. Сначала слушай, затем отвечай; текст можно открыть в любой момент.</p>
  {error&&<p className="warning" role="alert">{error} <button className="text-button" onClick={()=>setRetry(n=>n+1)}>Повторить</button></p>}
  {story?<StoryPractice key={story.id} story={story} speed={speed} profile={profile} onClose={()=>setSelected('')}/>:selected?<p role="status">{error?'Нажми «Повторить», чтобы загрузить историю.':'Загрузка истории…'}</p>:<>
   <p className="catalog-count" role="status">{loading?'Обновляем каталог…':catalog?`Найдено ${catalog.total} вариантов`:'Загружаем каталог…'}</p>
   <div className="audio-story-grid" aria-busy={loading}>{catalog?.items.map(s=>{
    const result=profile.data.audioPractice?.[s.id];
    return <article key={s.id} className="audio-story-card"><div className="eyebrow">{s.level} · {minutes(s.duration)} · {s.wordCount} СЛОВ</div><h3>{s.title}</h3><p>{result?`Последняя проверка: ${result.correct}/3 · ${result.assisted?'с текстом':'без текста'}`:'Два голоса · 3 вопроса на понимание'}</p><button className="button secondary small-button" disabled={!s.ready||loading||!!error} onClick={()=>setSelected(s.id)}>{s.ready?'Открыть историю':'Аудио готовится'}</button></article>;
   })}</div>
   {catalog&&<div className="audio-pagination"><button className="button secondary small-button" disabled={loading||catalog.page<=1} onClick={()=>setPage(n=>n-1)}>Назад</button><span>Страница {catalog.page} из {catalog.pages}</span><button className="button secondary small-button" disabled={loading||catalog.page>=catalog.pages} onClick={()=>setPage(n=>n+1)}>Дальше</button></div>}
  </>}
 </section>;
}
export function StoryPractice({story,speed,profile,onClose}:{story:AudioStory;speed:number;profile:Profile;onClose:()=>void}){
 const {play,stop,state,error}=useSpeechPlayer();const run=useRef(0),assistedRef=useRef(false);
 const [active,setActive]=useState<number|null>(null),[heard,setHeard]=useState(false),[showText,setShowText]=useState(false),[assisted,setAssisted]=useState(false),[answers,setAnswers]=useState<Record<string,number>>({}),[checked,setChecked]=useState(false);
 const cancel=()=>{run.current++;stop();setActive(null);};
 useEffect(()=>{run.current++;stop();setActive(null);return()=>{run.current++;stop();};},[speed,stop]);
 const listen=async()=>{
  cancel();const token=run.current;
  for(let i=0;i<story.segments.length;i++){
   if(token!==run.current)return;setActive(i);const segment=story.segments[i];
   const done=await play(segment.id,{source:segment.source,startAt:segment.startAt,endAt:segment.endAt,text:segment.text,locale:story.language==='it'?'it-IT':'en-GB',speed,onCancel:()=>{if(token===run.current){run.current++;setActive(null);}}});
   if(token!==run.current)return;if(!done){setActive(null);return;}
  }
  setActive(null);setHeard(true);
 };
 const reveal=()=>{if(!showText&&!checked){assistedRef.current=true;setAssisted(true);}setShowText(!showText);};
 const check=()=>{
  if(checked||(!heard&&!assistedRef.current)||story.questions.some(q=>answers[q.id]===undefined))return;
  const correct=story.questions.filter(q=>answers[q.id]===q.answer).length,now=new Date().toISOString();setChecked(true);
  profile.update(p=>({...p,audioPractice:{...p.audioPractice,[story.id]:{completedAt:now,correct,total:3,assisted:assistedRef.current}},events:[...p.events,{id:'audio-library:'+story.id+':'+crypto.randomUUID(),at:now,points:correct}].slice(-2000)}));
 };
 return <article className="audio-practice">
  <button className="text-button" onClick={()=>{cancel();onClose();}}>← К каталогу</button><div className="eyebrow">{story.level} · {minutes(story.duration)} · СЦЕНАРНЫЙ ВАРИАНТ</div><h3>{story.title}</h3>
  <div className="section-actions"><button className="button primary" disabled={!story.ready} onClick={()=>active===null?void listen():cancel()}>{active===null?'Слушать историю':state?.phase==='loading'?'Загрузка… · остановить':'Остановить'}</button><button className="text-button" aria-expanded={showText} onClick={reveal}>{showText?'Скрыть текст':'Показать текст и перевод'}</button></div>
  <p className="helper" role="status">{active!==null?`Сцена ${active+1} из ${story.segments.length}. Скорость ${speed}×.`:heard?'История прослушана целиком. Можно ответить на вопросы.':'Сначала прослушай всю историю или открой текст.'} {assisted&&'Эта попытка учитывается как работа с текстом.'}</p>
  {error&&<p className="warning" role="alert">{error}</p>}
  {showText&&<div className="audio-library-transcript">{story.segments.map((s,i)=><section key={s.id} className={active===i?'playing':''}><b>{i===0?'Рассказчик':voiceNames[s.voice]}</b><p lang={story.language}>{s.text}</p><p className="helper">{s.ru}</p></section>)}</div>}
  <div className="audio-questions">{story.questions.map((q,i)=><fieldset key={q.id} disabled={checked||(!heard&&!assisted)}><legend>{i+1}. {q.prompt}</legend>{q.options.map((option,j)=><label key={j} className={'audio-option'+(checked&&j===q.answer?' correct':'')}><input type="radio" name={q.id} value={j} checked={answers[q.id]===j} onChange={()=>setAnswers(a=>({...a,[q.id]:j}))}/><span>{option}</span></label>)}{checked&&<p className="audio-explanation"><strong>{answers[q.id]===q.answer?'Верно.':'Нужно повторить.'}</strong> Правильный ответ: {q.options[q.answer]}. {q.explanation}</p>}</fieldset>)}</div>
  {!checked?<button className="button primary" disabled={(!heard&&!assisted)||story.questions.some(q=>answers[q.id]===undefined)||!profile.ready} onClick={check}>Проверить ответы</button>:<p className="audio-score" role="status">Результат: {story.questions.filter(q=>answers[q.id]===q.answer).length}/3 · {assisted?'с помощью текста':'аудирование без текста'}. {profile.status==='synced'?'Сохранено в аккаунте.':profile.status==='conflict'?'Есть конфликт синхронизации: разреши его в настройках аккаунта.':'Синхронизация: '+(profile.status==='offline'?'ожидаем соединения':'ожидаем сохранения в аккаунте')+'.'}</p>}
  <p className="helper">Результат этой практики сохраняется отдельно от освоения интерактивных уроков.</p>
 </article>;
}
