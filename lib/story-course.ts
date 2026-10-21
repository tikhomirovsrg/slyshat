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
type Ref={set:'course'|'library';id:string};
type Raw=Omit<CourseStory,'nodes'>&{nodes:Record<string,Omit<CourseStory['nodes'][string],'clips'>&{clips:Ref[]}>};
let cache:{stories:Map<string,Raw>;metadata:any;hash:string}|undefined;
function source(){
 if(!cache){const db=getDb(),release=db.prepare('SELECT * FROM story_course_releases WHERE id=?').get('story-course-v1');if(!release)throw Error('Course is not installed');cache={hash:String(release.checksum),metadata:JSON.parse(String(release.metadata_json)),stories:new Map(db.prepare('SELECT data_json FROM story_course_entries ORDER BY language,position').all().map(row=>{const s=JSON.parse(String(row.data_json));return [s.id,s];}))};}return cache;
}
let media:Record<string,any>|undefined;
function recordings(){if(!media){media={};for(const set of ['course','library'])media[set]=JSON.parse(readFileSync(resolve(process.cwd(),`public/audio/${set}/manifest.json`),'utf8'));}if(media.course.sourceSha256!==source().hash)throw Error('Course recording version mismatch');return media;}
let boards:Map<string,ComicBoard>|undefined;
function comic(id:string){if(!boards)boards=new Map(getDb().prepare('SELECT story_id,data_json FROM comic_boards').all().map(r=>[String(r.story_id),JSON.parse(String(r.data_json))]));const board=boards.get(id);if(!board)throw Error('Comic is not installed');return board;}
function summary(s:Raw):StoryCard{const {id,language,level,position,art,legacy}=s;const board=characterBoard(comic(id),id,false),{cover,featured,actors,playerActorId}=board;const {title,topic,summary,hook,series}=storyPresentation(s,board,source().hash);const lead=actors?.find(a=>a.id!==playerActorId)||actors?.[0];return {id,language,level,position,title,topic,summary,art,legacy,comic:{hook,series,cover,featured,...(lead?{coverActor:{artBase:lead.artBase,artLayout:lead.artLayout,label:lead.label}}:{})}};}
export function storyCatalog(language:string):StoryCatalog{
 const data=source(),items=[...data.stories.values()].filter(s=>s.language===language).map(summary);
 return {items,total:items.length,counts:Object.fromEntries(levels.map(l=>[l,items.filter(s=>s.level===l).length])) as StoryCatalog['counts'],provenance:data.metadata.provenance};
}
export function courseStory(id:string):CourseStory|null{
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
 return {...s,...presentation,vocabulary:storyVocabulary(s,source().hash),comic:{...board,hook,series},nodes:Object.fromEntries(Object.entries(s.nodes).map(([nodeId,n])=>[nodeId,{...n,clips:n.clips.map((ref,i)=>clip(ref,nodeId,i)),choices:n.choices.map((choice,i)=>({...choice,...(audio?{clip:recorded(audio.stories[id].nodes[nodeId].choices[i],choice.text,choice.label,`${id}:${nodeId}:choice:${i}`,player)}:{})}))}]))};
}
export function validateCourseJourney(j:Journey){
 const data=source();
 for(const [lang,id] of Object.entries(j.active))if(data.stories.get(id!)?.language!==lang)throw Error('Unknown active course story');
 for(const [id,p] of Object.entries(j.stories)){
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
