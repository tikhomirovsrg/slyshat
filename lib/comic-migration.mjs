import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Frozen v1 recipe. A new visual release needs a new recipe/version, not edits here.
export function buildComicBoard(story, release, translate) {
 const topic=story.legacy?null:story.id.split('-').slice(3,-1).join('-');
 const profile=release.topics[topic];
 const cover=story.legacy?release.legacyLocations[story.id]:profile?.[0];
 if(!cover)throw Error('Missing comic setting: '+story.id);
 const series=profile?.[1]||({cafe:'Близкие люди',home:'Близкие люди',station:'Городские приключения',square:'Городские приключения',market:'Городские приключения',park:'Городские приключения',office:'Вместе за дело',gallery:'Культура и открытия'}[cover]);
 const featured=story.id==='coffee-it';
 const hook=featured?'Полчаса на встречу. Кафе, прогулка или новый день — какой план выберете вы?':profile?profile[3]+' '+release.problems[story.id.split('-').at(-1)]:story.summary;
 const cast=featured?['Джулия','Собеседник']:story.language==='it'?['Сара','Никола']:['Эмма','Джордж'];
 const scenes=Object.fromEntries(Object.entries(story.nodes).map(([id,node],index)=>{
  const custom=featured&&release.coffee[id];
  const ending=!node.choices.length;
  const shot=custom?.[1]||(id==='start'?'wide':id==='a'?'left':id==='b'?'right':['wide','left','right','detail'][index%4]);
  const prop=custom?.[3]||(id.endsWith('message')?'phone':id.endsWith('together')?'conversation':profile?.[2]||({station:'ticket',cafe:'cup',home:'parcel',office:'laptop',gallery:'book',square:'map',market:'cup',park:'map'}[cover]));
  const body=node.clips.map(translate).join('\n\n');
  if(!body)throw Error('Missing scene detail: '+story.id+'/'+id);
  return [id,{location:custom?.[0]||cover,shot,mood:custom?.[2]||(id==='start'?'neutral':ending?'neutral':'thinking'),prop,caption:custom?.[4]||(id==='start'?story.topic:ending?'К чему привёл твой выбор':id.endsWith('message')?'Договорённость в сообщении':id.endsWith('together')?'Следующий шаг — вместе':'Разговор меняет направление'),clue:{title:'Деталь сцены · перевод',body},beatAt:1.2}];
 }));
 return {releaseId:release.releaseId,hook,series,cover,featured,cast,scenes};
}

export function migrateComics(db,path=resolve(process.cwd(),'content/comics/comic-v1.json')) {
 const bytes=readFileSync(path),release=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 db.exec(`CREATE TABLE IF NOT EXISTS comic_releases(id TEXT PRIMARY KEY,checksum TEXT NOT NULL,metadata_json TEXT NOT NULL,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS comic_boards(story_id TEXT PRIMARY KEY,release_id TEXT NOT NULL,data_json TEXT NOT NULL CHECK(json_valid(data_json)));`);
 const applied=db.prepare('SELECT checksum FROM comic_releases WHERE id=?').get(release.releaseId);
 if(applied){if(applied.checksum!==hash)throw Error('Comic release changed: use a new releaseId.');return false;}
 const course=db.prepare('SELECT checksum,metadata_json FROM story_course_releases WHERE id=?').get('story-course-v1');
 if(release.formatVersion!==1||release.releaseId!=='comic-v1'||course?.checksum!==release.courseSha256)throw Error('Invalid comic release or course version');
 const metadata=JSON.parse(course.metadata_json),library=new Map(db.prepare('SELECT id,data_json FROM audio_content_segments').all().map(r=>[r.id,JSON.parse(r.data_json)]));
 const rows=db.prepare('SELECT data_json FROM story_course_entries').all();
 const boards=rows.map(row=>{const s=JSON.parse(row.data_json);return [s.id,buildComicBoard(s,release,ref=>(ref.set==='course'?metadata.segments[ref.id]:library.get(ref.id))?.ru)];});
 if(boards.length!==2000)throw Error('Incomplete comic coverage');
 db.prepare('INSERT INTO comic_releases VALUES(?,?,?,?)').run(release.releaseId,hash,JSON.stringify({provenance:release.provenance,publishedAt:release.publishedAt}),new Date().toISOString());
 const insert=db.prepare('INSERT INTO comic_boards VALUES(?,?,?)');for(const [id,board] of boards)insert.run(id,release.releaseId,JSON.stringify(board));
 return true;
}
