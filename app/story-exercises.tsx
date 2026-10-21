'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Check,Headphones,RotateCcw,Square} from 'lucide-react';
import type {buildStoryExercises} from '../lib/story-exercises.mjs';
import type {JourneyProgress} from '../lib/story-course-types';
import {exerciseSummary,getExerciseAttempt} from '../lib/story-exercise-state';

type ExerciseSet=NonNullable<ReturnType<typeof buildStoryExercises>>;
type ExerciseQuestion=ExerciseSet['questions'][number];
type ExerciseAnswer=ReturnType<typeof getExerciseAttempt>['answers'][string];
const skillLabels={comprehension:'Понимание истории',phrase:'Смысл реплики',sequence:'Порядок реплик'};

export function moveExerciseOption(values:string[],from:number,offset:number){
 const to=from+offset;if(from<0||from>=values.length||to<0||to>=values.length)return values;
 const next=[...values];[next[from],next[to]]=[next[to],next[from]];return next;
}

export function StoryExerciseCard({question,index,total,answer,ready,replaying,canReplay,onAnswer,onReplay,onNext,onPrevious}:{
 question:ExerciseQuestion;index:number;total:number;answer?:ExerciseAnswer;ready:boolean;replaying:boolean;canReplay:boolean;
 onAnswer:(ids:string[])=>void;onReplay:()=>void;onNext:()=>void;onPrevious:()=>void;
}){
 const [selection,setSelection]=useState<string[]>(()=>question.type==='sequence'?question.options.map(option=>option.id):[]),[moveMessage,setMoveMessage]=useState('');
 const selected=answer?.answerIds||selection,checked=!!answer;
 const correctOptions=checked?question.answerIds.map(id=>question.options.find(option=>option.id===id)?.text||''):[];
 const move=(position:number,offset:number)=>{setSelection(values=>moveExerciseOption(values,position,offset));setMoveMessage(`Реплика перемещена на позицию ${position+offset+1}.`);};
 return <div className="story-exercise-card">
  <div className="story-exercise-meta"><span>Задание {index+1} из {total}</span><span>{skillLabels[question.skill]}</span></div>
  <fieldset disabled={!ready||checked} className="story-exercise-fieldset"><legend>{question.prompt}</legend>
   {question.type==='sequence'?<><p className="story-exercise-instruction">Расставь реплики по порядку кнопками «выше» и «ниже».</p><ol className="story-exercise-order">{selected.map((id,position)=>{const option=question.options.find(item=>item.id===id);return <li key={id}><span className="story-exercise-position" aria-hidden="true">{position+1}</span><span>{option?.text}</span><div className="story-exercise-order-controls"><button type="button" disabled={!ready||checked||position===0} aria-label={`Переместить реплику ${position+1} выше`} onClick={()=>move(position,-1)}><ArrowUp size={18}/><span>Выше</span></button><button type="button" disabled={!ready||checked||position===selected.length-1} aria-label={`Переместить реплику ${position+1} ниже`} onClick={()=>move(position,1)}><ArrowDown size={18}/><span>Ниже</span></button></div></li>;})}</ol><p className="story-exercise-live" aria-live="polite">{moveMessage}</p></>:<div className="story-exercise-options">{question.options.map(option=><label key={option.id} className={selected.includes(option.id)?'selected':''}><input type="radio" name={'story-exercise-'+question.id} value={option.id} checked={selected.includes(option.id)} onChange={()=>setSelection([option.id])}/><span>{option.text}</span></label>)}</div>}
  </fieldset>
  <div className="story-exercise-audio"><button type="button" className="text-button" disabled={!ready||!canReplay} aria-pressed={replaying} onClick={onReplay}>{replaying?<Square size={17}/>:<Headphones size={17}/>} {replaying?'Остановить фрагмент':'Переслушать фрагмент'}</button>{!canReplay&&<small>Запись этого фрагмента пока недоступна.</small>}</div>
  {!checked?<button type="button" className="button primary story-exercise-check" disabled={!ready||!selected.length} onClick={()=>onAnswer([...selected])}>Проверить<Check size={18}/></button>:<div className={'story-exercise-feedback '+(answer.correct?'correct':'review')} role="status"><strong>{answer.correct?'Верно':'Есть неточность'}</strong><p>{question.explanation}</p>{!answer.correct&&(question.type==='sequence'?<><b>Порядок реплик:</b><ol>{correctOptions.map((text,i)=><li key={i}>{text}</li>)}</ol></>:<p><b>Ответ:</b> {correctOptions.join('; ')}</p>)}</div>}
  <div className="story-exercise-navigation">{index>0&&<button type="button" className="button secondary" disabled={!ready} onClick={onPrevious}><ArrowLeft size={16}/> Назад</button>}{checked&&<button type="button" className="button primary" disabled={!ready} onClick={onNext}>{index+1===total?'К итогу':'Дальше'}<ArrowRight size={17}/></button>}</div>
 </div>;
}

export function StoryExercises({exercises,progress,ready,playingQuestionId,evidenceAvailable,onAnswer,onReplay,onStopReplay,onRestart}:{
 exercises:ExerciseSet;progress:JourneyProgress;ready:boolean;playingQuestionId:string|null;evidenceAvailable:Record<string,boolean>;
 onAnswer:(questionId:string,answerIds:string[])=>void;onReplay:(question:ExerciseQuestion)=>void;onStopReplay:()=>void;onRestart:()=>void;
}){
 const attempt=getExerciseAttempt(exercises,progress),summary=exerciseSummary(exercises,progress);
 const [index,setIndex]=useState(()=>{const first=exercises.questions.findIndex(question=>!attempt.answers[question.id]);return first<0?exercises.questions.length:first;}),[round,setRound]=useState(0);
 const questionRef=useRef<HTMLDivElement>(null),navigated=useRef(false);
 useEffect(()=>{if(navigated.current){questionRef.current?.focus();navigated.current=false;}},[index,round]);
 const current=exercises.questions[index],showSummary=!current&&summary.completed;
 const changeQuestion=(next:number)=>{onStopReplay();navigated.current=true;setIndex(Math.max(0,Math.min(exercises.questions.length,next)));};
 const restart=()=>{onStopReplay();onRestart();navigated.current=true;setRound(value=>value+1);setIndex(0);};
 return <section className="story-exercises" aria-labelledby="story-exercises-heading">
  <header className="story-exercises-heading"><span className="comic-kicker">ПОСЛЕ ИСТОРИИ</span><h2 id="story-exercises-heading">Что произошло?</h2><p>Задания о событиях твоего маршрута.</p><div className="story-exercises-progress"><progress aria-label="Выполненные задания" max={summary.total} value={summary.answered}/><span>{summary.answered} / {summary.total}</span></div></header>
  <div className="story-exercise-focus" ref={questionRef} tabIndex={-1}>{showSummary?<div className="story-exercise-result" role="status"><h3>Верно: {summary.correct} из {summary.total}</h3><p>{summary.correct===summary.total?'Ты разобрался в событиях этой истории.':'Можно переслушать диалог и ещё раз разобрать события.'}</p>{summary.assisted&&<p>Результат с дополнительной помощью.</p>}{summary.replayed&&<p>Использовалось повторное прослушивание.</p>}<p className="story-exercise-result-note">Это результат заданий по этой истории. Уровень языка по нему не определяется.</p><div className="section-actions"><button type="button" className="button primary" disabled={!ready} onClick={restart}><RotateCcw size={17}/> Повторить задания</button><button type="button" className="button secondary" disabled={!ready} onClick={()=>changeQuestion(0)}>Посмотреть разбор<ArrowRight size={17}/></button></div></div>:current?<StoryExerciseCard key={current.id+'-'+round} question={current} index={index} total={exercises.questions.length} answer={attempt.answers[current.id]} ready={ready} replaying={playingQuestionId===current.id} canReplay={!!evidenceAvailable[current.id]} onAnswer={ids=>{onStopReplay();onAnswer(current.id,ids);}} onReplay={()=>onReplay(current)} onNext={()=>changeQuestion(index+1)} onPrevious={()=>changeQuestion(index-1)}/>:<button type="button" className="button secondary" disabled={!ready} onClick={()=>changeQuestion(0)}>Вернуться к заданиям</button>}</div>
 </section>;
}
