export const levels=['A1','A2','B1','B2','C1'] as const;
export type Level=typeof levels[number];
export type Skill='grammar'|'vocabulary'|'reading'|'listening';
export type QuestionAudio={text:string;ru:string;locale:string};
export type Question={id:string;kind:'choice'|'gap'|'order'|'transform'|'reading';skill:Skill;prompt:string;text?:string;options?:string[];answer:string;accepted?:string[];words?:string[];explanation:string;source?:string;audio?:QuestionAudio};
export type PracticeSet={id:string;episode:string;language:'en'|'it';level:Level;title:string;description:string;minutes:number;questions:Question[]};
export type LearningPack={episode:string;level:Level;grammar:{title:string;explanation:string;examples:{text:string;ru:string}[]};reading:{title:string;kind:string;text:string};exercises:Question[];writing:{prompt:string;min:number;max:number;checklist:string[]}};
export type CheckedAnswer={value:string;correct:boolean;checkedAt:string;listened?:boolean;assisted?:boolean};
export type WordReview={step:number;due:string;reviews:number;last:string};
export type Practice={answers:Record<string,CheckedAnswer>;draft:string;checks:boolean[];reviews:Record<string,WordReview>;errorReviews:Record<string,CheckedAnswer>;mistakes:string[];lastActivity:string|null};
export const freshPractice=():Practice=>({answers:{},draft:'',checks:[],reviews:{},errorReviews:{},mistakes:[],lastActivity:null});
export const normalise=(s:string)=>s.trim().toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/[.!?]+$/,'');
export const wordCount=(s:string)=>(s.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[]).length;
export const isCorrect=(q:Question,value:string)=>{
 const clean=(s:string)=>normalise(q.audio&&q.kind==='gap'?s.replace(/[,;:—–]/g,' '):s);
 return [q.answer,...q.accepted||[]].some(a=>clean(a)===clean(value));
};
// Opening the transcript makes the attempt reading, even if audio was also played.
export const answerSkill=(q:Question,a:CheckedAnswer):Skill=>q.audio? a.listened&&!a.assisted?'listening':'reading':q.skill;
export const reviewIntervals=[1,3,7,14,30];
export function nextReview(old:WordReview|undefined,known:boolean,now=new Date()):WordReview{const step=known?Math.min((old?.step??-1)+1,4):0;const due=new Date(now);if(known)due.setDate(due.getDate()+reviewIntervals[step]);else due.setMinutes(due.getMinutes()+10);return {step:known?step:-1,due:due.toISOString(),reviews:(old?.reviews||0)+1,last:now.toISOString()};}
