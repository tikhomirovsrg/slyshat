import type {Language} from '../app/episodes';
import type {Level} from '../app/study-types';
export type AudioQuestion={id:string;prompt:string;options:string[];answer:number;explanation:string};
export type AudioStorySummary={id:string;language:Language;level:Level;title:string;topic:string;variant:string;wordCount:number;duration:number;ready:boolean};
export type AudioSegment={id:string;text:string;ru:string;voice:string;source:string;startAt:number;endAt:number};
export type AudioStory=AudioStorySummary&{segments:AudioSegment[];questions:AudioQuestion[]};
export type AudioCatalog={items:AudioStorySummary[];total:number;page:number;pages:number;counts:Record<Level,number>;levels:Record<Level,{label:string;grammar:string;focus:string}>;topics:{id:string;title:string}[];provenance:string};
export type AudioPracticeResult={completedAt:string;correct:number;total:3;assisted:boolean};
