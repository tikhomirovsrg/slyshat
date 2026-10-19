import {episodes} from './episodes';
import {freshPractice,type Practice} from './study-types';
import {getPack} from './packs';
import {validateProfile,type StudyProfile} from './profile-types';
export type Phase='context'|'listen'|'decode'|'dialogue'|'transfer'|'done';
export type Attempt={plays:number;text:boolean;translation:boolean};
export type Result={choice:number;correct:boolean;withoutText:boolean;firstListen:boolean;listened:boolean};
export type Progress={version:1;episode:string;started:boolean;phase:Phase;node:string;phraseIndex:number;transferIndex:number;openingAnswer:number|null;outcome:string|null;saved:string[];attempts:Record<string,Attempt>;results:Record<string,Result>;history:{node:string;reply:string}[];speed:number;voiceMaya:string;voiceOliver:string;finishedAt:string|null;practice:Practice};
export const phases:Phase[]=['context','listen','decode','dialogue','transfer','done'];
export const fresh=(id='coffee-01'):Progress=>({version:1,episode:id,started:false,phase:'context',node:'start',phraseIndex:0,transferIndex:0,openingAnswer:null,outcome:null,saved:[],attempts:{},results:{},history:[],speed:1,voiceMaya:'',voiceOliver:'',finishedAt:null,practice:freshPractice()});
export function resultFor(choice:number,answer:number,a?:Attempt):Result{return {choice,correct:choice===answer,withoutText:!!a?.plays&&!a.text&&!a.translation,firstListen:a?.plays===1&&!a.text&&!a.translation,listened:!!a?.plays};}
export function validateProgress(value:unknown):Progress{
 if(!value||typeof value!=='object')throw new Error('Это не файл прогресса.');
 const p=value as Progress;const e=episodes.find(e=>e.id===p.episode);
 if(p.version!==1||!e||!phases.includes(p.phase)||!Object.prototype.hasOwnProperty.call(e.nodes,p.node))throw new Error('Файл относится к неизвестной истории или версии.');
 if(!Number.isInteger(p.phraseIndex)||p.phraseIndex<0||p.phraseIndex>2||!Number.isInteger(p.transferIndex)||p.transferIndex<0||p.transferIndex>=e.transfer.length)throw new Error('В файле повреждена позиция урока.');
 if(!Array.isArray(p.saved)||p.saved.some(x=>!e.phrases.some(f=>f.id===x))||!Array.isArray(p.history)||p.history.length>200||p.history.some(h=>!h||!Object.prototype.hasOwnProperty.call(e.nodes,h.node)||typeof h.reply!=='string'||h.reply.length>1000))throw new Error('В файле повреждена история.');
 if(!p.attempts||typeof p.attempts!=='object'||Array.isArray(p.attempts)||Object.keys(p.attempts).length>150)throw new Error('В файле повреждены попытки.');
 for(const a of Object.values(p.attempts))if(!a||!Number.isInteger(a.plays)||a.plays<0||a.plays>100000||typeof a.text!=='boolean'||typeof a.translation!=='boolean')throw new Error('В файле повреждены попытки.');
 if(!p.results||typeof p.results!=='object'||Array.isArray(p.results)||Object.keys(p.results).length>e.transfer.length)throw new Error('В файле повреждены результаты.');
 for(const [key,r] of Object.entries(p.results)){const t=e.transfer.find(t=>t.id===key);if(!t||!r||!Number.isInteger(r.choice)||r.choice<0||r.choice>=t.options.length||['correct','withoutText','firstListen','listened'].some(k=>typeof r[k as keyof Result]!=='boolean'))throw new Error('В файле повреждены результаты.');}
 if(typeof p.started!=='boolean'||![0.75,0.9,1,1.1].includes(p.speed)||typeof p.voiceMaya!=='string'||typeof p.voiceOliver!=='string'||!(p.openingAnswer===null||(Number.isInteger(p.openingAnswer)&&p.openingAnswer>=0&&p.openingAnswer<e.openingQuestion.options.length))||!(p.outcome===null||Object.hasOwn(e.outcomes,p.outcome))||!(p.finishedAt===null||typeof p.finishedAt==='string'))throw new Error('Не удалось проверить настройки файла.');
 const practice={...freshPractice(),...p.practice};const pack=getPack(e.id);
 if(typeof practice.draft!=='string'||practice.draft.length>12000||!Array.isArray(practice.checks)||practice.checks.length>10||practice.checks.some(x=>typeof x!=='boolean')||!Array.isArray(practice.mistakes)||practice.mistakes.length>30||practice.mistakes.some(x=>typeof x!=='string')||!(practice.lastActivity===null||typeof practice.lastActivity==='string'))throw new Error('Повреждена письменная практика.');
 for(const group of [practice.answers,practice.errorReviews]){if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).length>30)throw new Error('Повреждены задания.');for(const [id,a] of Object.entries(group))if(!a||typeof a.value!=='string'||a.value.length>2000||typeof a.correct!=='boolean'||!Number.isFinite(Date.parse(a.checkedAt))||(pack&&!pack.exercises.some(q=>q.id===id)&&!e.transfer.some(t=>t.id===id)))throw new Error('Неизвестное задание.');}
 if(!practice.reviews||typeof practice.reviews!=='object'||Array.isArray(practice.reviews)||Object.keys(practice.reviews).length>e.phrases.length)throw new Error('Повреждён словарь.');
 for(const [id,r] of Object.entries(practice.reviews))if(!e.phrases.some(f=>f.id===id)||!r||!Number.isInteger(r.step)||r.step< -1||r.step>4||!Number.isFinite(Date.parse(r.due))||!Number.isInteger(r.reviews)||r.reviews<0||!Number.isFinite(Date.parse(r.last)))throw new Error('Повреждено повторение.');
 return {...fresh(e.id),...p,practice};
}
export type Collection={kind:'slyshat-collection';version:2;active:string;progress:Record<string,Progress>;studyProfile?:StudyProfile};
export function validateCollection(value:unknown):Collection{
 if(!value||typeof value!=='object')throw new Error('Это не файл прогресса.');
 const v=value as Collection;
 if(v.kind!=='slyshat-collection'){const old=validateProgress(value);return {kind:'slyshat-collection',version:2,active:old.episode,progress:{[old.episode]:old}};}
 if(v.version!==2||!v.progress||typeof v.progress!=='object'||Array.isArray(v.progress)||Object.keys(v.progress).length>episodes.length)throw new Error('Неизвестный формат коллекции.');
 const progress:Record<string,Progress>={};
 for(const [id,data] of Object.entries(v.progress)){const p=validateProgress(data);if(id!==p.episode)throw new Error('Истории в файле не совпадают.');progress[id]=p;}
 if(!Object.hasOwn(progress,v.active))throw new Error('В файле отсутствует выбранная история.');
 return {kind:'slyshat-collection',version:2,active:v.active,progress,...(v.studyProfile?{studyProfile:validateProfile(v.studyProfile)}:{})};
}
// Preserve the original key so the first episode survives this update.
export const storageKey=(id:string)=>id==='coffee-01'?'slyshat-progress-v1':`slyshat-progress-v1:${id}`;
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 if(!('indexedDB' in window)){reject(new Error('Unavailable'));return;}
 const req=indexedDB.open('slyshat',1);let expired=false;
 const timer=setTimeout(()=>{expired=true;reject(new Error('Storage timeout'));},2000);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('progress'))req.result.createObjectStore('progress');};
 req.onsuccess=()=>{clearTimeout(timer);if(expired)req.result.close();else resolve(req.result);};
 req.onerror=()=>{clearTimeout(timer);reject(req.error);};
});}
export async function loadProgress(id='coffee-01'):Promise<Progress|null>{
 const key=storageKey(id);
 try{const raw=localStorage.getItem(key);if(raw){const p=validateProgress(JSON.parse(raw));if(p.episode===id)return p;}}catch{}
 try{const db=await openDb();const value=await new Promise<unknown>((resolve,reject)=>{const tx=db.transaction('progress','readonly');const q=tx.objectStore('progress').get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);tx.oncomplete=()=>db.close();});const p=value?validateProgress(value):null;return p?.episode===id?p:null;}catch{return null;}
}
export async function saveProgress(p:Progress):Promise<'db'|'local'|'memory'>{
 const key=storageKey(p.episode);let backup=false;try{localStorage.setItem(key,JSON.stringify(p));backup=true;}catch{}
 try{const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('progress','readwrite');tx.objectStore('progress').put(p,key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});return 'db';}catch{return backup?'local':'memory';}
}
