import type {ExpansionRelease} from './story-expansion.mjs';
export const EXPANSION_LEVEL_SPEED:Record<string,Record<string,number>>;
export function validateExpansionAudio(manifest:unknown,release:ExpansionRelease,cast:unknown,castHash:string,options?:{directory?:string;hashFiles?:boolean}):{readyStories:number;clips:number;files:number};
