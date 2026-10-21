import type {JourneyProgress,StoryExerciseAttempt} from './story-course-types';
import {gradeStoryExercise,type StoryExerciseSet,type StoryExerciseQuestion} from './story-exercises.mjs';

const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const timestamp=(value:unknown)=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const id=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(value);

export function validateExerciseAttemptShape(value:unknown):StoryExerciseAttempt{
  const e=value as StoryExerciseAttempt;
  if(!record(value)||!id(e.version)||typeof e.routeKey!=='string'||e.routeKey.length>256||!e.routeKey.length||!record(e.answers)||Object.keys(e.answers).length>8||typeof e.assisted!=='boolean'||typeof e.replayed!=='boolean'||!timestamp(e.updatedAt)||(e.completedAt!==undefined&&!timestamp(e.completedAt)))throw Error('Invalid story exercise attempt');
  for(const [questionId,answer] of Object.entries(e.answers)){
    if(!id(questionId)||!record(answer)||!Array.isArray(answer.answerIds)||answer.answerIds.length<1||answer.answerIds.length>8||new Set(answer.answerIds).size!==answer.answerIds.length||answer.answerIds.some(option=>!id(option))||typeof answer.correct!=='boolean'||typeof answer.assisted!=='boolean'||!timestamp(answer.checkedAt))throw Error('Invalid story exercise answer');
  }
  return e;
}

function routeMatches(set:StoryExerciseSet,p:JourneyProgress){return !!p.finishedAt&&set.routeKey===`${set.releaseId}:${set.storyId}:${p.path.join('.')}`;}
function requireRoute(set:StoryExerciseSet,p:JourneyProgress){if(!routeMatches(set,p))throw Error('Exercises do not belong to this finished story route');}
function inheritedAssistance(set:StoryExerciseSet,p:JourneyProgress){return p.assisted.length>0||set.questions.some(question=>question.evidence.some(ref=>!p.heard.includes(ref.nodeId)));}
function validAnswer(question:StoryExerciseQuestion,answerIds:string[]){
  return Array.isArray(answerIds)&&new Set(answerIds).size===answerIds.length&&answerIds.length===(question.type==='sequence'?question.options.length:1)&&answerIds.every(id=>question.options.some(option=>option.id===id));
}

export function getExerciseAttempt(set:StoryExerciseSet,p:JourneyProgress):StoryExerciseAttempt{
  requireRoute(set,p);
  const old=p.exercises,assisted=inheritedAssistance(set,p);
  const fresh:StoryExerciseAttempt={version:set.releaseId,routeKey:set.routeKey,answers:{},assisted,replayed:false,updatedAt:p.updatedAt};
  if(!old||old.version!==set.releaseId||old.routeKey!==set.routeKey)return fresh;
  // A damaged local optional result must not display an invented score or
  // prevent the learner from continuing the story. Keep only valid answers,
  // recompute their grades, and leave all non-exercise progress untouched.
  try{validateExerciseAttemptShape(old);}catch{return {...fresh,assisted:assisted||old.assisted===true||old.replayed===true,replayed:old.replayed===true};}
  const answers:StoryExerciseAttempt['answers']={};
  for(const question of set.questions){const answer=old.answers[question.id];if(answer&&validAnswer(question,answer.answerIds))answers[question.id]={...answer,answerIds:[...answer.answerIds],correct:gradeStoryExercise(question,answer.answerIds)};}
  const {completedAt:_completed,...rest}=old,complete=set.questions.every(q=>!!answers[q.id]);
  const lastChecked=Object.values(answers).reduce((latest,answer)=>Date.parse(answer.checkedAt)>Date.parse(latest)?answer.checkedAt:latest,Object.values(answers)[0]?.checkedAt||p.updatedAt);
  return {...rest,answers,assisted:old.assisted||old.replayed||assisted||Object.values(answers).some(answer=>answer.assisted),...(complete?{completedAt:old.completedAt||lastChecked}:{})};
}

// Helpers only update optional exercise state. They do not award listening,
// change CEFR, create activity points or revoke a completed story.
export function answerExercise(set:StoryExerciseSet,p:JourneyProgress,questionId:string,answerIds:string[],at=new Date().toISOString()):JourneyProgress{
  const attempt=getExerciseAttempt(set,p),question=set.questions.find(q=>q.id===questionId);
  if(!question||!validAnswer(question,answerIds)||!timestamp(at))throw Error('Invalid exercise response');
  const assisted=attempt.assisted||!!attempt.answers[questionId];
  const answers={...attempt.answers,[questionId]:{answerIds:[...answerIds],correct:gradeStoryExercise(question,answerIds),checkedAt:at,assisted}};
  const complete=set.questions.every(q=>!!answers[q.id]);
  return {...p,updatedAt:at,exercises:{...attempt,answers,assisted,updatedAt:at,...(complete?{completedAt:attempt.completedAt||at}:{})}};
}

export function assistExercises(set:StoryExerciseSet,p:JourneyProgress,help:{replayed?:boolean;text?:boolean},at=new Date().toISOString()):JourneyProgress{
  const attempt=getExerciseAttempt(set,p);if(!timestamp(at))throw Error('Invalid exercise timestamp');
  return {...p,updatedAt:at,exercises:{...attempt,assisted:attempt.assisted||!!help.replayed||!!help.text,replayed:attempt.replayed||!!help.replayed,updatedAt:at}};
}

export function restartExercises(set:StoryExerciseSet,p:JourneyProgress,at=new Date().toISOString()):JourneyProgress{
  const attempt=getExerciseAttempt(set,p);if(!timestamp(at))throw Error('Invalid exercise timestamp');
  const {completedAt:_completed,...rest}=attempt;
  return {...p,updatedAt:at,exercises:{...rest,answers:{},assisted:attempt.assisted||Object.keys(attempt.answers).length>0,updatedAt:at}};
}

export function exerciseSummary(set:StoryExerciseSet,p:JourneyProgress){
  const attempt=getExerciseAttempt(set,p),answers=set.questions.flatMap(q=>attempt.answers[q.id]?[attempt.answers[q.id]]:[]);
  return {correct:answers.filter(a=>a.correct).length,total:set.questions.length,answered:answers.length,completed:answers.length===set.questions.length,assisted:attempt.assisted,replayed:attempt.replayed};
}

// Used by the server before persisting a profile: clients cannot submit a
// different route's score, unknown options, or an invented correctness flag.
export function validateExerciseAttempt(set:StoryExerciseSet|null,p:JourneyProgress){
  if(!p.exercises)return;
  const attempt=validateExerciseAttemptShape(p.exercises);
  if(!set||!routeMatches(set,p)||attempt.version!==set.releaseId||attempt.routeKey!==set.routeKey)throw Error('Stale story exercise route or version');
  if((inheritedAssistance(set,p)||attempt.replayed)&&!attempt.assisted)throw Error('Missing story exercise assistance');
  for(const [id,answer] of Object.entries(attempt.answers)){
    const question=set.questions.find(q=>q.id===id);
    if(!question||!validAnswer(question,answer.answerIds)||answer.correct!==gradeStoryExercise(question,answer.answerIds)||answer.assisted&&!attempt.assisted)throw Error('Story exercise answer does not match its question');
  }
  const completed=set.questions.every(q=>!!attempt.answers[q.id]);
  if(!!attempt.completedAt!==completed)throw Error('Invalid story exercise completion');
}
