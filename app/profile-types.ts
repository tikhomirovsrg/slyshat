import {levels,type Level,type Skill,type CheckedAnswer} from './study-types';
import type {Language} from './episodes';
import type {AudioPracticeResult} from '../lib/audio-library-types';
import type {Journey} from '../lib/story-course-types';
import {validateJourney} from './story-course-state';
export type TestAnswer=CheckedAnswer&{skill:Skill;assisted:boolean};
export type TestRun={id:string;kind:'placement'|'control';language:Language;level:Level;questionIds:string[];answers:Record<string,TestAnswer>;finishedAt:string|null};
export type StudyProfile={version:1;levels:Record<Language,Level>;goal:'social'|'travel'|'work'|'culture';dailyGoal:number;events:{id:string;at:string;points:number}[];tests:TestRun[];audioPractice?:Record<string,AudioPracticeResult>;journey?:Journey};
export const freshProfile=():StudyProfile=>({version:1,levels:{en:'A2',it:'A1'},goal:'social',dailyGoal:10,events:[],tests:[]});
export function validateProfile(raw:unknown):StudyProfile{
 const p=raw as StudyProfile;
 if(!p||p.version!==1||!p.levels||!levels.includes(p.levels.en)||!levels.includes(p.levels.it)||!['social','travel','work','culture'].includes(p.goal)||![5,10,15,20].includes(p.dailyGoal)||!Array.isArray(p.events)||p.events.length>2000||!Array.isArray(p.tests)||p.tests.length>50)throw new Error('Invalid profile');
 for(const e of p.events)if(!e||typeof e.id!=='string'||e.id.length>200||!Number.isFinite(Date.parse(e.at))||!Number.isInteger(e.points)||e.points<0||e.points>10)throw new Error('Invalid activity');
 if(p.journey!==undefined)validateJourney(p.journey);
 if(p.audioPractice!==undefined){
  if(!p.audioPractice||typeof p.audioPractice!=='object'||Array.isArray(p.audioPractice)||Object.keys(p.audioPractice).length>2000)throw new Error('Invalid audio practice');
  for(const [id,a] of Object.entries(p.audioPractice))if(!/^(en|it)-(a1|a2|b1|b2|c1)-[a-z]+-[a-z]+$/.test(id)||!a||!Number.isFinite(Date.parse(a.completedAt))||!Number.isInteger(a.correct)||a.correct<0||a.correct>3||a.total!==3||typeof a.assisted!=='boolean')throw new Error('Invalid audio result');
 }
 for(const t of p.tests){if(!t||typeof t.id!=='string'||!['placement','control'].includes(t.kind)||!['en','it'].includes(t.language)||!levels.includes(t.level)||!Array.isArray(t.questionIds)||t.questionIds.length>20||new Set(t.questionIds).size!==t.questionIds.length||t.questionIds.some(id=>typeof id!=='string'||id.length>200)||!t.answers||Object.keys(t.answers).length>20||!(t.finishedAt===null||Number.isFinite(Date.parse(t.finishedAt))))throw new Error('Invalid test');for(const [id,a] of Object.entries(t.answers))if(!t.questionIds.includes(id)||!a||typeof a.value!=='string'||a.value.length>2000||typeof a.correct!=='boolean'||typeof a.assisted!=='boolean'||(a.listened!==undefined&&typeof a.listened!=='boolean')||!['grammar','vocabulary','reading','listening'].includes(a.skill)||!Number.isFinite(Date.parse(a.checkedAt)))throw new Error('Invalid answer');}
 return p;
}
export const dayKey=(time:string)=>new Date(time).toLocaleDateString('en-CA');
export function activityStats(p:StudyProfile,now=new Date()){
 const today=dayKey(now.toISOString()),days=new Set(p.events.map(e=>dayKey(e.at)));let streak=0;const date=new Date(now);
 if(!days.has(today))date.setDate(date.getDate()-1);
 while(days.has(dayKey(date.toISOString()))){streak++;date.setDate(date.getDate()-1);}
 return {streak,today:p.events.filter(e=>dayKey(e.at)===today).length,points:p.events.reduce((n,e)=>n+e.points,0)};
}
