import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
export function migrateStoryCourse(db, path=resolve(process.cwd(),'content/story-course/course-v1.json')) {
 const bytes=readFileSync(path),source=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 db.exec(`CREATE TABLE IF NOT EXISTS story_course_releases(id TEXT PRIMARY KEY,checksum TEXT NOT NULL,metadata_json TEXT NOT NULL,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS story_course_entries(id TEXT PRIMARY KEY,language TEXT NOT NULL,level TEXT NOT NULL,position INTEGER NOT NULL,data_json TEXT NOT NULL CHECK(json_valid(data_json)),UNIQUE(language,position));
 CREATE INDEX IF NOT EXISTS story_course_order ON story_course_entries(language,level,position);`);
 const applied=db.prepare('SELECT checksum FROM story_course_releases WHERE id=?').get(source.releaseId);
 if(applied){if(applied.checksum!==hash)throw Error('Story course changed: use a new releaseId.');return false;}
 if(source.formatVersion!==1||source.stories?.length!==2000)throw Error('Invalid story course');
 const ids=new Set();
 for(const lang of ['en','it'])for(const level of ['A1','A2','B1','B2','C1'])if(source.stories.filter(s=>s.language===lang&&s.level===level).length!==200)throw Error('Unbalanced story course');
 for(const s of source.stories){
  if(ids.has(s.id)||!s.nodes[s.start])throw Error('Invalid story identity');ids.add(s.id);
  const visited=new Set();
  function visit(id,path){if(path.has(id))throw Error('Cyclic story');const node=s.nodes[id];if(!node||!node.clips.length||(!node.choices.length&&!node.outcome))throw Error('Missing story node or ending');visited.add(id);const next=new Set([...path,id]);for(const c of node.choices){if(!c.text||!c.label)throw Error('Empty choice');visit(c.next,next);}}
  visit(s.start,new Set());if(visited.size!==Object.keys(s.nodes).length)throw Error('Unreachable story node');
  for(const node of Object.values(s.nodes))for(const c of node.clips){if(c.set==='course'&&!source.segments[c.id])throw Error('Missing course recording text');if(c.set==='library'&&!db.prepare('SELECT id FROM audio_content_segments WHERE id=?').get(c.id))throw Error('Missing library recording text');}
 }
 const {stories,...metadata}=source;
 db.prepare('INSERT INTO story_course_releases VALUES(?,?,?,?)').run(source.releaseId,hash,JSON.stringify(metadata),new Date().toISOString());
 const insert=db.prepare('INSERT INTO story_course_entries VALUES(?,?,?,?,?)');for(const s of stories)insert.run(s.id,s.language,s.level,s.position,JSON.stringify(s));
 return true;
}
