import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {readExpansion,expansionClipId,expansionChoiceId,expansionExerciseSource,type ExpansionStory} from './story-expansion.mjs';
import {validateExpansionAudio} from './story-expansion-audio.mjs';
import type {StoryCard,CourseStory,StoryClip} from './story-course-types';
import type {ComicActor,ComicBoard} from './comic-types';

type Cue={voice:string;actorId:string;file:string;start:number;end:number};
type Cast={actors:Record<string,Omit<ComicActor,'voice'|'name'|'sourceVoice'|'voiceProfileId'>>;voiceProfiles:Record<string,{id:string;voice:string}>};
let cache:{stories:Map<string,ExpansionStory>;manifest:{segments:Record<string,Cue>}|null;cast:Cast}|undefined;
export function expansionCourse(){
 if(!cache){
  const release=readExpansion(),bytes=readFileSync(resolve(process.cwd(),'content/characters/cast-v1.json')),cast=JSON.parse(String(bytes));
  const directory=resolve(process.cwd(),'public/audio/expansion'),path=resolve(directory,'manifest.json');
  const manifest=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
  // An absent release has no recorded audio. A present release must pass the
  // complete text/speaker/file checks; never advertise a partial one as ready.
  if(manifest)validateExpansionAudio(manifest,release,cast,createHash('sha256').update(bytes).digest('hex'),{directory});
  cache={stories:new Map(release.stories.map(story=>[story.id,story])),manifest,cast};
 }
 return cache;
}
function actors(story:ExpansionStory):[ComicActor,ComicActor]{
 const {cast}=expansionCourse();
 return story.cast.map(member=>{
  const profile=cast.voiceProfiles[member.actorId+'-'+story.language];
  return {...cast.actors[member.actorId],id:member.actorId,name:member.name,label:member.roleRU,voiceProfileId:profile.id,voice:profile.voice,sourceVoice:profile.voice};
 }) as [ComicActor,ComicActor];
}
function series(story:ExpansionStory){return story.language==='en'?'Small stories, unexpected turns':'Piccole storie, svolte inattese';}
export function expansionCard(story:ExpansionStory):StoryCard{
 const cast=actors(story),lead=cast[1],location=story.nodes.start.frame.location;
 return {id:story.id,language:story.language,level:story.level,position:0,title:story.title,topic:story.topic,summary:story.summary,
  art:location==='station'?'train':location==='cafe'||location==='market'?'coffee':location==='office'?'work':'film',legacy:false,archived:false,audioMode:expansionCourse().manifest?'recorded':'text',
  comic:{hook:story.hook,series:series(story),cover:location,featured:false,coverActor:{artBase:lead.artBase,artLayout:lead.artLayout,label:lead.label}}};
}
export function expansionStory(id:string):CourseStory|null{
 const data=expansionCourse(),story=data.stories.get(id);if(!story)return null;
 const cast=actors(story),exerciseSource=expansionExerciseSource(story);
 const clip=(key:string,text:string,ru:string,speaker:number):StoryClip=>{
  const actor=cast[speaker],cue=data.manifest?.segments[key];
  return {id:key,text,ru,voice:cue?.voice||actor.voice,source:cue?'/audio/expansion/'+cue.file:'',startAt:cue?.start??0,endAt:cue?.end??0,actorId:actor.id,actorName:actor.name};
 };
 const comic:ComicBoard={releaseId:'story-expansion-comic-v1',hook:story.hook,series:series(story),cover:story.nodes.start.frame.location,featured:false,
  cast:[cast[0].id,cast[1].id],actors:cast,playerActorId:cast[0].id,castReleaseId:'story-expansion-cast-v1',
  scenes:Object.fromEntries(Object.entries(story.nodes).map(([id,node],index)=>[id,{...node.frame,shot:index===0?'wide':index%2?'left':'right',beatAt:2}]))};
 return {...expansionCard(story),context:story.context,start:story.start,origin:'story-expansion-v1',comic,vocabulary:story.vocabulary,
  authoredExercises:exerciseSource.authoredExercises,sourceAttribution:{title:story.source.title,author:story.source.author,adaptation:story.source.adaptation},
  nodes:Object.fromEntries(Object.entries(story.nodes).map(([id,node])=>[id,{clips:node.lines.map((line,index)=>clip(expansionClipId(story.id,id,index),line.text,line.ru,line.speaker)),
   choices:node.choices.map((choice,index)=>({text:choice.text,label:choice.ru,next:choice.next,clip:clip(expansionChoiceId(story.id,id,index),choice.text,choice.ru,0)})),...(node.outcome?{outcome:node.outcome}:{})}]))};
}
