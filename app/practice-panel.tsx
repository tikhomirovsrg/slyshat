'use client';
import {useState} from 'react';
import type {Episode} from './episodes';
import type {Progress} from './learning';
import {getPack} from './packs';
import {getPracticeSets,extraQuestions} from './extra-practice';
import {wordCount,type Practice,type CheckedAnswer,type Question} from './study-types';
import {lessonScore} from './study';
import {QuestionCard} from './question-card';
type Tab='grammar'|'reading'|'exercises'|'writing'|'errors'|'extra';
export function PracticePanel({episode,p,onChange,onActivity,initial='grammar'}:{episode:Episode;p:Progress;onChange:(fn:(p:Progress)=>Progress)=>void;onActivity:(id:string,points?:number)=>void;initial?:Tab}){
 const [tab,setTab]=useState(initial);
 const [retry,setRetry]=useState<string|null>(null);
 const [index,setIndex]=useState(0);
 const [setId,setSetId]=useState<string|null>(null);
 const pack=getPack(episode.id);
 if(!pack)return null;
 const sets=getPracticeSets(episode.id),extra=extraQuestions(episode.id),selectedSet=sets.find(s=>s.id===setId);
 const patch=(fn:(practice:Practice)=>Practice)=>onChange(s=>({...s,practice:{...fn(s.practice),lastActivity:new Date().toISOString()}}));
 const score=lessonScore(episode,p),words=wordCount(p.practice.draft);
 const answered=pack.exercises.filter(q=>p.practice.answers[q.id]).length;
 const extraAnswered=extra.filter(q=>p.practice.answers[q.id]).length;
 const audioErrors:Question[]=episode.transfer.filter(t=>p.results[t.id]&&!p.results[t.id].correct).map(t=>({id:t.id,kind:'choice',skill:'listening',prompt:t.question,options:t.options,answer:t.options[t.answer],explanation:t.explanation,audio:{text:t.text,ru:t.ru,locale:episode.locale}}));
 const errors:Question[]=[...[...pack.exercises,...extra].filter(q=>p.practice.mistakes.includes(q.id)),...audioErrors];
 const pendingErrors=errors.filter(q=>!p.practice.errorReviews[q.id]?.correct);
 const questions=tab==='errors'?errors:tab==='extra'?selectedSet?.questions||[]:pack.exercises;
 const q=questions[Math.min(index,questions.length-1)];
 const group=tab==='errors'?'errorReviews':'answers';
 const check=(answer:CheckedAnswer)=>{
  if(!q)return;
  patch(v=>({...v,[group]:{...v[group],[q.id]:answer},mistakes:!answer.correct&&!v.mistakes.includes(q.id)?[...v.mistakes,q.id]:v.mistakes}));
  setRetry(null);onActivity('exercise:'+episode.id+':'+q.id,answer.correct?2:1);
 };
 const changeTab=(next:Tab)=>{setTab(next);setIndex(0);setRetry(null);setSetId(null);};
 const tabs:[Tab,string][]=[['grammar','Грамматика'],['reading','Чтение'],['exercises',`Упражнения ${answered}/${pack.exercises.length}`],['extra',`Ещё практика ${extraAnswered}/${extra.length}`],['writing','Письмо'],['errors',`Ошибки ${pendingErrors.length}`]];
 const showQuestion=tab==='exercises'||tab==='errors'||tab==='extra'&&!!selectedSet;
 return <section className="practice-panel">
  <div className="practice-heading"><div><span className="eyebrow">УЧЕБНЫЙ БЛОК · {pack.level}</span><h2>Разобраться глубже</h2><p>После истории можно продолжить: {['A1','A2'].includes(pack.level)?'ещё 10–15':'ещё 20–25'} минут. В «Ещё практике» — короткие блоки примерно на 6 минут, которые можно пройти отдельно. Уровень обозначает сложность практики.</p></div><span className={'mastery-badge '+(score.mastered?'mastered':'')}>{score.mastered?'Урок освоен':`${score.percent}% заданий`}</span></div>
  <div className="study-tabs" role="group" aria-label="Части учебного блока">{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} aria-pressed={tab===id} onClick={()=>changeTab(id)}>{label}</button>)}</div>
  {tab==='grammar'&&<div className="grammar-note"><h3>{pack.grammar.title}</h3><p>{pack.grammar.explanation}</p>{pack.grammar.examples.map(x=><blockquote key={x.text}><p lang={episode.language}>{x.text}</p><small>{x.ru}</small></blockquote>)}</div>}
  {tab==='reading'&&<div className="reading-text"><span className="eyebrow">{pack.reading.kind} · {pack.level}</span><h3>{pack.reading.title}</h3><p lang={episode.language}>{pack.reading.text}</p><button className="button secondary small-button" onClick={()=>{setTab('exercises');setIndex(Math.max(0,pack.exercises.findIndex(q=>q.skill==='reading')));}}>Вопросы к тексту</button></div>}
  {tab==='extra'&&<div className="extra-practice">
   <p className="helper">Новые задания · октябрь 2026. Это дополнительная практика: она сохраняется в прогрессе и не меняет освоение основного урока. Можно пройти один блок сегодня, остальные — позже.</p>
   {!selectedSet?<div className="practice-set-grid">{sets.map(s=>{
    const done=s.questions.filter(q=>p.practice.answers[q.id]).length;
    const correct=s.questions.filter(q=>(p.practice.errorReviews[q.id]||p.practice.answers[q.id])?.correct).length;
    return <button key={s.id} className="practice-set-card" onClick={()=>{setSetId(s.id);setRetry(null);setIndex(Math.max(0,s.questions.findIndex(q=>!p.practice.answers[q.id])));}}><span>{s.level} · ~{s.minutes} мин · {done===0?'Новый блок':done===s.questions.length?'Пройден':'Продолжить'}</span><strong>{s.title}</strong><p>{s.description}</p><small>{done}/{s.questions.length} ответов · {correct} верных →</small></button>;
   })}</div>:<div className="extra-set-heading"><button className="text-button" onClick={()=>{setSetId(null);setIndex(0);setRetry(null);}}>← Все блоки</button><h3>{selectedSet.title}</h3><p>{selectedSet.description}</p>{selectedSet.questions.every(q=>p.practice.answers[q.id])&&<p className="helper" role="status">Все 4 ответа сохранены. Можно разобрать ошибки или перейти к другому блоку.</p>}</div>}
  </div>}
  {showQuestion&&(q?<>
   <div className="exercise-pagination"><button disabled={index===0} onClick={()=>{setIndex(Math.max(0,index-1));setRetry(null);}}>← Назад</button><span>{Math.min(index+1,questions.length)} / {questions.length}</span><button disabled={index>=questions.length-1} onClick={()=>{setIndex(index+1);setRetry(null);}}>Дальше →</button></div>
   <QuestionCard key={q.id+':'+tab+':'+retry} q={q} audio={q.audio} voice={p.voiceOliver} speed={p.speed} source={q.source||(q.skill==='reading'?pack.reading.text:undefined)} result={retry===q.id?undefined:p.practice[group][q.id]} onAnswer={check}/>
   {p.practice[group][q.id]&&<button className="text-button" onClick={()=>setRetry(q.id)}>Ответить ещё раз</button>}
  </>:<p>Ошибок для повторения пока нет. Текст всегда доступен рядом с вопросами на чтение.</p>)}
  {tab==='writing'&&<div className="writing-practice"><h3>Твоя письменная сцена</h3><p>{pack.writing.prompt}</p><label>Черновик<textarea lang={episode.language} maxLength={12000} rows={9} value={p.practice.draft} onChange={e=>patch(v=>({...v,draft:e.target.value,checks:[]}))} placeholder="Начни писать на языке истории…"/></label><div className="draft-info"><span>{words} слов · ориентир {pack.writing.min}–{pack.writing.max}</span><span>Черновик сохраняется с прогрессом</span></div><p className="helper">Счётчик проверяет только длину. Грамматику, смысл и выполнение задачи оцениваешь ты. После изменения текста самопроверку нужно повторить.</p>{pack.writing.checklist.map((c,i)=><label className="self-check" key={c}><input type="checkbox" checked={!!p.practice.checks[i]} onChange={e=>{const checked=e.target.checked;patch(v=>({...v,checks:pack.writing.checklist.map((_,n)=>n===i?checked:!!v.checks[n])}));if(checked)onActivity('writing:'+episode.id+':'+i);}}/>{c}</label>)}{(words<pack.writing.min||words>pack.writing.max)&&<p className="helper">Для завершения письменной части приведи текст к указанному объёму.</p>}</div>}
  <div className="mastery-note">{score.mastered?'Освоено: задания и письменная самопроверка завершены.':`Для освоения: завершить историю, набрать минимум 80% в ${score.total} основных заданиях и выполнить самопроверку письма.`} {score.writing?'Письменная часть отмечена.':''}</div>
 </section>;
}
