import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getDb} from './db';
import type {CourseStory,StoryCard,StoryCatalog,Journey,StoryClip} from './story-course-types';
import {storyRoute} from '../app/story-course-state';
import type {ComicBoard} from './comic-types';
import {levels} from '../app/study-types';
import {characterBoard,characterCourse,characterRecordings} from './character-course';
import {characterForVoice} from './character-cast.mjs';
import {buildStoryExercises} from './story-exercises.mjs';
import {validateExerciseAttempt} from './story-exercise-state';
import {storyPresentation} from './story-presentation';
import {storyVocabulary} from './story-vocabulary';
import {buildStoryCuration,storyCurationProvenance,type StoryCatalogPlacement} from './story-curation';
import {expansionCourse,expansionCard,expansionStory} from './story-expansion-course';
import {expansionExerciseSource} from './story-expansion.mjs';
type Ref={set:'course'|'library';id:string};
type Raw=Omit<CourseStory,'nodes'>&{nodes:Record<string,Omit<CourseStory['nodes'][string],'clips'>&{clips:Ref[]}>};
let cache:{stories:Map<string,Raw>;metadata:any;hash:string;curation:Map<string,StoryCatalogPlacement>}|undefined;
function source(){
 if(!cache){const db=getDb(),release=db.prepare('SELECT * FROM story_course_releases WHERE id=?').get('story-course-v1');if(!release)throw Error('Course is not installed');const hash=String(release.checksum),stories=new Map<string,Raw>(db.prepare('SELECT data_json FROM story_course_entries ORDER BY language,position').all().map(row=>{const s=JSON.parse(String(row.data_json));return [s.id,s];}));cache={hash,metadata:JSON.parse(String(release.metadata_json)),stories,curation:buildStoryCuration([...stories.values()],hash)};}return cache;
}
let media:Record<string,any>|undefined;
function recordings(){if(!media){media={};for(const set of ['course','library'])media[set]=JSON.parse(readFileSync(resolve(process.cwd(),`public/audio/${set}/manifest.json`),'utf8'));}if(media.course.sourceSha256!==source().hash)throw Error('Course recording version mismatch');return media;}
let boards:Map<string,ComicBoard>|undefined;
function comic(id:string){if(!boards)boards=new Map(getDb().prepare('SELECT story_id,data_json FROM comic_boards').all().map(r=>[String(r.story_id),JSON.parse(String(r.data_json))]));const board=boards.get(id);if(!board)throw Error('Comic is not installed');return board;}
function summary(s:Raw):StoryCard{const {id,language,level,position,art,legacy}=s;const board=characterBoard(comic(id),id,false),{cover,featured,actors,playerActorId}=board;const {title,topic,summary,hook,series}=storyPresentation(s,board,source().hash);const lead=actors?.find(a=>a.id!==playerActorId)||actors?.[0];return {id,language,level,position,title,topic,summary,art,legacy,comic:{hook,series,cover,featured,...(lead?{coverActor:{artBase:lead.artBase,artLayout:lead.artLayout,label:lead.label}}:{})}};}
let active:StoryCard[]|undefined;
function activeCards(){
 if(!active){
  const data=source(),retained=[...data.stories.values()].filter(s=>!data.curation.get(s.id)!.archived).map(s=>({...summary(s),...data.curation.get(s.id)!}));
  const added=[...expansionCourse().stories.values()].map(expansionCard);
  active=['en','it'].flatMap(language=>[...retained,...added].filter(story=>story.language===language)
   .sort((a,b)=>levels.indexOf(a.level)-levels.indexOf(b.level)).map((story,index)=>({...story,position:index+1})));
 }
 return active;
}
export function storyCatalog(language:string,includeArchived=false):StoryCatalog{
 const data=source(),rows=[...data.stories.values()].filter(s=>s.language===language),card=(s:Raw):StoryCard=>({...summary(s),...data.curation.get(s.id)!});
 const items=activeCards().filter(story=>story.language===language);
 return {items,total:items.length,counts:Object.fromEntries(levels.map(l=>[l,items.filter(s=>s.level===l).length])) as StoryCatalog['counts'],provenance:storyCurationProvenance+' + story-expansion-v1',...(includeArchived?{archived:rows.filter(s=>data.curation.get(s.id)!.archived).map(card)}:{})};
}
export function courseStory(id:string):CourseStory|null{
 if(id.startsWith('new-')){const story=expansionStory(id),card=activeCards().find(item=>item.id===id);return story&&card?{...story,position:card.position}:null;}
 const s=source().stories.get(id);if(!s)return null;const audio=characterRecordings(),m=audio?null:recordings();
 const {release,audioSources}=characterCourse(),assignment=release.stories[id];
 const player=assignment.cast.find(a=>a.actorId===assignment.playerActorId)!;
 function recorded(key:string,text:string,ru:string,clipId:string,actor:{actorId:string;name:string}):StoryClip{
  const info=audio.segments[key];
  return {id:clipId,text,ru,voice:info.voice,source:`/audio/characters/${info.file}`,startAt:info.start,endAt:info.end,actorId:actor.actorId,actorName:actor.name};
 }
 function clip(ref:Ref,nodeId:string,index:number):StoryClip{
  const data=(ref.set==='course'?audioSources.course.segments:audioSources.librarySegments)[ref.id],actor=characterForVoice(assignment,data.voice);
  if(audio)return recorded(audio.stories[id].nodes[nodeId].clips[index],data.text,data.ru,ref.id,actor);
  const info=m![ref.set].segments[ref.id];
  if(!info||!data||info.textSha256!==data.textSha256||info.voice!==data.voice)throw Error('Recording does not match text');
  return {id:ref.id,text:data.text,ru:data.ru,voice:info.voice,source:`/audio/${ref.set}/${info.file}`,startAt:info.start,endAt:info.end,actorId:actor.actorId,actorName:actor.name};
 }
 const board=characterBoard(comic(s.id),id,!!audio),{hook,series,...presentation}=storyPresentation(s,board,source().hash);
 const placement=source().curation.get(s.id)!,position=placement.archived?placement.position:activeCards().find(item=>item.id===id)!.position;
 return {...s,...presentation,...placement,position,vocabulary:storyVocabulary(s,source().hash),comic:{...board,hook,series},nodes:Object.fromEntries(Object.entries(s.nodes).map(([nodeId,n])=>[nodeId,{...n,clips:n.clips.map((ref,i)=>clip(ref,nodeId,i)),choices:n.choices.map((choice,i)=>({...choice,...(audio?{clip:recorded(audio.stories[id].nodes[nodeId].choices[i],choice.text,choice.label,`${id}:${nodeId}:choice:${i}`,player)}:{})}))}]))};
}
export function validateCourseJourney(j:Journey){
 const data=source();
 const expanded=(id:string)=>id.startsWith('new-')?expansionCourse().stories.get(id):undefined;
 for(const [lang,id] of Object.entries(j.active))if((data.stories.get(id!)||expanded(id!))?.language!==lang)throw Error('Unknown active course story');
 for(const [id,p] of Object.entries(j.stories)){
  const fresh=expanded(id);
  if(fresh){
   const story=expansionExerciseSource(fresh),route=storyRoute(story as CourseStory,p.path),last=route.at(-1)!;
   if(p.finishedAt&&story.nodes[last].choices.length)throw Error('Story has not reached an ending');
   if([...p.heard,...p.assisted].some(node=>!route.includes(node)))throw Error('Unvisited story scene');
   if(p.endings?.some(node=>!story.nodes[node]||story.nodes[node].choices.length))throw Error('Invalid ending');
   if(p.exercises)validateExerciseAttempt(buildStoryExercises(story,p.path),p);
   continue;
  }
  const s=data.stories.get(id);if(!s)throw Error('Unknown course story');
  const route=storyRoute(s as unknown as CourseStory,p.path),last=route.at(-1)!;
  if(p.finishedAt&&s.nodes[last].choices.length)throw Error('Story has not reached an ending');
  if([...p.heard,...p.assisted].some(node=>!route.includes(node)))throw Error('Unvisited story scene');
  if(p.endings?.some(node=>!s.nodes[node]||s.nodes[node].choices.length))throw Error('Invalid ending');
  if(p.exercises){
   const {audioSources}=characterCourse();
   const exerciseSource={...s,nodes:Object.fromEntries(Object.entries(s.nodes).map(([nodeId,node])=>[nodeId,{...node,clips:node.clips.map(ref=>({id:ref.id,...(ref.set==='course'?audioSources.course.segments:audioSources.librarySegments)[ref.id]}))}]))};
   validateExerciseAttempt(buildStoryExercises(exerciseSource,p.path),p);
  }
 }
}
