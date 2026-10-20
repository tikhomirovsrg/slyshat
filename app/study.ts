import {episodes,getEpisode,type Episode} from './episodes';
import {packs,getPack} from './packs';
import {practiceSets,extraQuestions} from './extra-practice';
import {levels,isCorrect,wordCount,answerSkill,type Question,type Level,type Skill} from './study-types';
import type {Progress} from './learning';
export const skillNames:Record<Skill,string>={grammar:'Грамматика',vocabulary:'Лексика',reading:'Чтение',listening:'Аудирование'};
export function lessonScore(e:Episode,p:Progress){const pack=getPack(e.id);const q=pack?.exercises||[];const exerciseCorrect=q.filter(x=>{const r=p.practice.errorReviews[x.id]?.correct?p.practice.errorReviews[x.id]:p.practice.answers[x.id];return r&&isCorrect(x,r.value);}).length;const audioCorrect=e.transfer.filter(x=>p.results[x.id]?.choice===x.answer||p.practice.errorReviews[x.id]?.value===x.options[x.answer]).length;const total=q.length+e.transfer.length,correct=exerciseCorrect+audioCorrect;const words=wordCount(p.practice.draft);const writing=!!pack&&p.practice.checks.length===pack.writing.checklist.length&&p.practice.checks.every(Boolean)&&words>=pack.writing.min&&words<=pack.writing.max;return {correct,total,percent:Math.round(correct/total*100),writing,mastered:!!p.finishedAt&&correct/total>=.8&&writing};}
export type BankQuestion=Question&{key:string;episode:string;level:Level;source?:string;audio?:{text:string;ru:string;locale:string}};
export function questionBank(language:string):BankQuestion[]{
 const original=packs.filter(p=>getEpisode(p.episode).language===language).flatMap(p=>{
  const e=getEpisode(p.episode);
  return [...p.exercises.map(q=>({...q,key:e.id+'::'+q.id,episode:e.id,level:p.level,...(q.skill==='reading'?{source:p.reading.text}:{})})),...e.transfer.map(t=>({id:t.id,key:e.id+'::'+t.id,episode:e.id,level:p.level,kind:'choice' as const,skill:'listening' as const,prompt:t.question,options:t.options,answer:t.options[t.answer],explanation:t.explanation,audio:{text:t.text,ru:t.ru,locale:e.locale}}))];
 });
 return [...original,...practiceSets.filter(s=>s.language===language).flatMap(s=>s.questions.map(q=>({...q,key:s.episode+'::'+q.id,episode:s.episode,level:s.level})))];
}
export function testQuestions(language:string,kind:'placement'|'control',level:Level,variant=0):BankQuestion[]{
 const bank=questionBank(language);
 // Existing placement questions and saved test IDs remain stable.
 if(kind==='placement')return levels.flatMap(l=>['grammar','vocabulary','reading','listening'].map(skill=>bank.find(q=>q.level===l&&q.skill===skill)).filter((q):q is BankQuestion=>!!q));
 const pool=bank.filter(q=>q.level===level),result:BankQuestion[]=[];
 for(let round=0;result.length<12&&round<12;round++)for(const skill of ['grammar','vocabulary','reading','listening']){
  const group=pool.filter(q=>q.skill===skill);
  const q=group.length?group[(round+Math.max(0,Math.floor(variant))*3)%group.length]:undefined;
  if(q&&!result.some(old=>old.key===q.key)&&result.length<12)result.push(q);
 }
 return result;
}
export function recommendedLevel(answers:Record<string,{correct:boolean}>,questions:BankQuestion[]):Level{let selected:Level='A1';for(const level of levels){const group=questions.filter(q=>q.level===level);if(group.length===4&&group.filter(q=>answers[q.key]?.correct).length>=3)selected=level;else break;}return selected;}
export function skillStats(book:Record<string,Progress>){const result=Object.fromEntries(Object.keys(skillNames).map(s=>[s,{correct:0,total:0}])) as Record<Skill,{correct:number;total:number}>;for(const e of episodes){const p=book[e.id];if(!p)continue;for(const q of [...getPack(e.id)?.exercises||[],...extraQuestions(e.id)]){const r=p.practice.answers[q.id];if(r){const skill=answerSkill(q,r);result[skill].total++;if(isCorrect(q,r.value))result[skill].correct++;}}for(const q of e.transfer){const r=p.results[q.id];if(r){const skill=r.listened&&r.withoutText?'listening':'reading';result[skill].total++;if(r.choice===q.answer)result[skill].correct++;}}}return result;}
