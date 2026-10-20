import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getDb} from './db';
import type {AudioCatalog,AudioStory,AudioStorySummary,AudioSegment,AudioQuestion} from './audio-library-types';
import {levels} from '../app/study-types';

type RawStory=Omit<AudioStorySummary,'duration'|'ready'>&{segments:string[];questions:AudioQuestion[]};
type Manifest={releaseId:string;sourceSha256:string;files:Record<string,{sha256:string;bytes:number;duration:number}>;segments:Record<string,{file:string;start:number;end:number;textSha256:string;voice:string}>};
let manifest:Manifest|undefined;
const recordings=()=>manifest??=JSON.parse(readFileSync(resolve(process.cwd(),'public/audio/library/manifest.json'),'utf8')) as Manifest;
function summary(s:RawStory):AudioStorySummary{
 const m=recordings(),clips=s.segments.map(id=>m.segments[id]);
 const ready=clips.every(c=>c&&m.files[c.file]&&c.end>c.start&&c.end<=m.files[c.file].duration);
 return {id:s.id,language:s.language,level:s.level,title:s.title,topic:s.topic,variant:s.variant,wordCount:s.wordCount,ready,duration:ready?clips.reduce((n,c)=>n+c.end-c.start,0):0};
}
export function audioStory(id:string):AudioStory|null{
 const db=getDb(),row=db.prepare('SELECT data_json FROM audio_content_stories WHERE id=?').get(id);if(!row)return null;
 const s=JSON.parse(String(row.data_json)) as RawStory,m=recordings(),segments:AudioSegment[]=[];
 for(const id of s.segments){
  const clip=m.segments[id],row=db.prepare('SELECT data_json FROM audio_content_segments WHERE id=?').get(id);if(!clip||!row)return null;
  const data=JSON.parse(String(row.data_json));if(clip.textSha256!==data.textSha256||clip.voice!==data.voice)return null;
  segments.push({id,text:data.text,ru:data.ru,voice:data.voice,source:'/audio/library/'+clip.file,startAt:clip.start,endAt:clip.end});
 }
 return {...summary(s),segments,questions:s.questions};
}
export function audioCatalog(params:URLSearchParams):AudioCatalog{
 const language=params.get('language')==='it'?'it':'en',level=params.get('level')||'all',search=(params.get('q')||'').trim().slice(0,120),topic=params.get('topic')||'';
 const requestedPage=Number(params.get('page')||1),db=getDb(),metaRow=db.prepare('SELECT checksum,metadata_json FROM audio_content_releases WHERE id=?').get(recordings().releaseId);
 if(!metaRow||metaRow.checksum!==recordings().sourceSha256)throw new Error('Audio source and recordings do not match.');
 const metadata=JSON.parse(String(metaRow.metadata_json));
 const rows=db.prepare('SELECT data_json FROM audio_content_stories WHERE language=? ORDER BY id').all(language).map(row=>JSON.parse(String(row.data_json)) as RawStory);
 const counts=Object.fromEntries(levels.map(l=>[l,rows.filter(s=>s.level===l&&summary(s).ready).length])) as AudioCatalog['counts'];
 const found=rows.filter(s=>(level==='all'||s.level===level)&&(!topic||s.topic===topic)&&(!search||s.title.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))));
 const pages=Math.max(1,Math.ceil(found.length/12)),page=Math.max(1,Math.min(pages,Number.isFinite(requestedPage)?Math.floor(requestedPage):1));
 return {items:found.slice((page-1)*12,page*12).map(summary),total:found.length,page,pages,counts,levels:metadata.levels,topics:metadata.topics.map((t:{id:string;title:string})=>({id:t.id,title:t.title})),provenance:metadata.provenance};
}
