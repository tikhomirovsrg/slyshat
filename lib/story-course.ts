import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getDb} from './db';
import type {CourseStory,StoryCard,StoryCatalog,Journey,StoryClip} from './story-course-types';
import {storyRoute} from '../app/story-course-state';
import {levels} from '../app/study-types';
type Ref={set:'course'|'library';id:string};
type Raw=Omit<CourseStory,'nodes'>&{nodes:Record<string,Omit<CourseStory['nodes'][string],'clips'>&{clips:Ref[]}>};
let cache:{stories:Map<string,Raw>;metadata:any;hash:string}|undefined;
function source(){
 if(!cache){const db=getDb(),release=db.prepare('SELECT * FROM story_course_releases WHERE id=?').get('story-course-v1');if(!release)throw Error('Course is not installed');cache={hash:String(release.checksum),metadata:JSON.parse(String(release.metadata_json)),stories:new Map(db.prepare('SELECT data_json FROM story_course_entries ORDER BY language,position').all().map(row=>{const s=JSON.parse(String(row.data_json));return [s.id,s];}))};}return cache;
}
let media:Record<string,any>|undefined;
function recordings(){if(!media){media={};for(const set of ['course','library'])media[set]=JSON.parse(readFileSync(resolve(process.cwd(),`public/audio/${set}/manifest.json`),'utf8'));}if(media.course.sourceSha256!==source().hash)throw Error('Course recording version mismatch');return media;}
function summary(s:Raw):StoryCard{const {id,language,level,position,title,topic,summary,art,legacy}=s;return {id,language,level,position,title,topic,summary,art,legacy};}
export function storyCatalog(language:string):StoryCatalog{
 const data=source(),items=[...data.stories.values()].filter(s=>s.language===language).map(summary);
 return {items,total:items.length,counts:Object.fromEntries(levels.map(l=>[l,items.filter(s=>s.level===l).length])) as StoryCatalog['counts'],provenance:data.metadata.provenance};
}
export function courseStory(id:string):CourseStory|null{
 const s=source().stories.get(id);if(!s)return null;const m=recordings();
 function clip(ref:Ref):StoryClip{
  const info=m[ref.set].segments[ref.id],data=ref.set==='course'?source().metadata.segments[ref.id]:JSON.parse(String(getDb().prepare('SELECT data_json FROM audio_content_segments WHERE id=?').get(ref.id)?.data_json));
  if(!info||!data||info.textSha256!==data.textSha256||info.voice!==data.voice)throw Error('Recording does not match text');
  return {id:ref.id,text:data.text,ru:data.ru,voice:info.voice,source:`/audio/${ref.set}/${info.file}`,startAt:info.start,endAt:info.end};
 }
 return {...s,nodes:Object.fromEntries(Object.entries(s.nodes).map(([id,n])=>[id,{...n,clips:n.clips.map(clip)}]))};
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
 }
}
