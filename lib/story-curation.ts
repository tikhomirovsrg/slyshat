import release from '../content/story-curation/v1.json';
import {levels,type Level} from '../app/study-types';
import type {StoryCard} from './story-course-types';

type SourceCard=Pick<StoryCard,'id'|'language'|'level'|'position'|'legacy'>;
export type StoryCatalogPlacement={level:Level;position:number;archived:boolean};
type Selection={id:string;level:string;family:string;reason:string};
type CurationRelease={formatVersion:number;releaseId:string;courseSha256:string;provenance:string;stories:Selection[];excludedFamilies?:{language:string;family:string;reason:string}[]};

// A curated catalogue is a view over the published course. Source IDs, speech,
// branch graphs and saved attempts remain valid, including archived stories.
export function buildStoryCuration(stories:SourceCard[],sourceHash:string,selection:CurationRelease=release):Map<string,StoryCatalogPlacement>{
 if(selection.formatVersion!==1||selection.releaseId!=='story-curation-v1'||selection.courseSha256!==sourceHash)throw Error('Story curation version mismatch');
 const source=new Map(stories.map(story=>[story.id,story]));
 if(source.size!==stories.length)throw Error('Duplicate source story identity');
 const chosen=new Map<string,Selection>(),families=new Set<string>();
 for(const entry of selection.stories){
  const story=source.get(entry.id);
  if(!story||chosen.has(entry.id)||!levels.includes(entry.level as Level)||!entry.reason.trim())throw Error('Invalid curated story: '+entry.id);
  const family=story.legacy?'original:'+story.id:'variant:'+story.id.split('-').at(-1);
  if(entry.family!==family||families.has(story.language+':'+family))throw Error('Repeated curated plot family: '+entry.id);
  chosen.set(entry.id,entry);families.add(story.language+':'+family);
 }
 const availableFamilies=new Set(stories.filter(story=>!story.legacy).map(story=>story.language+':variant:'+story.id.split('-').at(-1)));
 const excluded=new Set<string>();
 for(const entry of selection.excludedFamilies||[]){
  const key=entry.language+':'+entry.family;
  if(!availableFamilies.has(key)||excluded.has(key)||families.has(key)||!entry.reason.trim())throw Error('Invalid withheld plot family: '+key);
  excluded.add(key);
 }
 for(const family of availableFamilies)if(!families.has(family)&&!excluded.has(family))throw Error('Unreviewed plot family: '+family);
 const result=new Map<string,StoryCatalogPlacement>();
 for(const language of ['en','it']){
  const active=stories.filter(story=>story.language===language&&chosen.has(story.id)).sort((a,b)=>levels.indexOf(chosen.get(a.id)!.level as Level)-levels.indexOf(chosen.get(b.id)!.level as Level)||a.position-b.position);
  if(!active.length)throw Error('Empty curated language: '+language);
  active.forEach((story,index)=>result.set(story.id,{level:chosen.get(story.id)!.level as Level,position:index+1,archived:false}));
 }
 for(const story of stories)if(!chosen.has(story.id))result.set(story.id,{level:story.level,position:story.position,archived:true});
 return result;
}

export const storyCurationProvenance=release.provenance;
