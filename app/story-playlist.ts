import type {CourseStory,StoryClip} from '../lib/story-course-types';
import {storyRoute} from './story-course-state';

export type StoryPlaylistEntry={clip:StoryClip;nodeId:string;kind:'scene'|'choice';clipIndex:number;choiceIndex?:number};
export const hasRecordedClip=(clip?:StoryClip):clip is StoryClip=>!!clip?.source;

export function scenePlaylist(story:Pick<CourseStory,'nodes'>,nodeId:string):StoryPlaylistEntry[]{
 return story.nodes[nodeId].clips.map((clip,clipIndex)=>({clip,nodeId,kind:'scene',clipIndex}));
}

function routeEntries(story:Pick<CourseStory,'start'|'nodes'>,path:number[]):StoryPlaylistEntry[]{
 return storyRoute(story,path).flatMap((nodeId,index)=>{
  const entries=scenePlaylist(story,nodeId),choiceIndex=path[index],choice=story.nodes[nodeId].choices[choiceIndex];
  if(hasRecordedClip(choice?.clip))entries.push({clip:choice.clip,nodeId,kind:'choice',clipIndex:0,choiceIndex});
  return entries;
 });
}

// Only the selected route belongs in the full dialogue. Some scenes begin by
// repeating the player's selected answer; keep that turn once, as the choice.
// Explicit actor identity is required: another speaker can repeat the words.
export function routePlaylist(story:Pick<CourseStory,'start'|'nodes'>,path:number[]):StoryPlaylistEntry[]{
 const entries=routeEntries(story,path);
 return entries.filter((entry,index)=>{
  const previous=entries[index-1];
  return !(entry.kind==='scene'&&entry.clipIndex===0&&hasRecordedClip(entry.clip)&&previous?.kind==='choice'&&previous.nodeId!==entry.nodeId&&previous.clip.actorId&&previous.clip.actorId===entry.clip.actorId&&previous.clip.text===entry.clip.text);
 });
}

// Exercise evidence can replay only recordings already on the selected route.
// Keep original scene references, including an answer omitted from full-dialogue
// playback: questions identify their evidence by its scene node and clip ID.
export function exercisePlaylist(story:Pick<CourseStory,'start'|'nodes'>,path:number[],evidence:readonly {nodeId:string;clipId:string}[]):StoryPlaylistEntry[]{
 const requested=new Set(evidence.map(item=>item.nodeId+'\0'+item.clipId));
 return routeEntries(story,path).filter(entry=>hasRecordedClip(entry.clip)&&requested.has(entry.nodeId+'\0'+entry.clip.id));
}

export async function playStoryPlaylist(entries:readonly StoryPlaylistEntry[],options:{
 isCurrent:()=>boolean;getSpeed:()=>number;
 onEntry:(entry:StoryPlaylistEntry,index:number)=>void;
 play:(entry:StoryPlaylistEntry,speed:number,index:number)=>Promise<boolean>;
}):Promise<boolean>{
 if(!entries.length)return false;
 for(let index=0;index<entries.length;index++){
  if(!options.isCurrent())return false;
  const entry=entries[index];options.onEntry(entry,index);
  const complete=await options.play(entry,options.getSpeed(),index);
  // A source that ends after navigation/cancellation must not start another clip.
  if(!complete||!options.isCurrent())return false;
 }
 return true;
}
