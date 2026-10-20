import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// Called inside the existing migration transaction. No user state is replaced.
export function migrateAudioLibrary(db,version,sourcePath=resolve(process.cwd(),'content/audio-library/series-v1.json')){
 if(version<5)db.exec(`
  CREATE TABLE IF NOT EXISTS audio_content_releases(id TEXT PRIMARY KEY, checksum TEXT NOT NULL, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)), applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audio_content_segments(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES audio_content_releases(id), data_json TEXT NOT NULL CHECK(json_valid(data_json)));
  CREATE TABLE IF NOT EXISTS audio_content_stories(id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES audio_content_releases(id), language TEXT NOT NULL CHECK(language IN ('en','it')), level TEXT NOT NULL CHECK(level IN ('A1','A2','B1','B2','C1')), title TEXT NOT NULL, data_json TEXT NOT NULL CHECK(json_valid(data_json)));
  CREATE INDEX IF NOT EXISTS audio_content_filter ON audio_content_stories(language,level,id);
 `);
 const bytes=readFileSync(sourcePath),checksum=createHash('sha256').update(bytes).digest('hex'),source=JSON.parse(bytes);
 if(source.formatVersion!==1||!source.releaseId||!Array.isArray(source.stories)||!source.segments||!source.levels)throw new Error('Invalid audio content release.');
 const applied=db.prepare('SELECT checksum FROM audio_content_releases WHERE id=?').get(source.releaseId);
 if(applied){if(applied.checksum!==checksum)throw new Error('Audio content changed without a new releaseId.');return false;}
 const ids=new Set(),texts=new Set();
 for(const story of source.stories){
  if(!story.id||ids.has(story.id)||!source.levels[story.level]||!['en','it'].includes(story.language)||story.segments.length!==4||story.questions.length!==3)throw new Error('Invalid audio story.');
  ids.add(story.id);
  for(const id of story.segments){const s=source.segments[id];if(!s||s.language!==story.language||s.level!==story.level||!s.text||!s.ru||createHash('sha256').update(s.text).digest('hex')!==s.textSha256)throw new Error('Invalid audio segment.');}
  const text=story.segments.map(id=>source.segments[id].text).join('\n');if(texts.has(text))throw new Error('Duplicate audio story.');texts.add(text);
  for(const q of story.questions)if(!q.prompt||q.options.length!==4||new Set(q.options).size!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!q.explanation)throw new Error('Invalid audio question.');
 }
 const {stories,segments,...metadata}=source;
 db.prepare('INSERT INTO audio_content_releases VALUES(?,?,?,?)').run(source.releaseId,checksum,JSON.stringify(metadata),new Date().toISOString());
 const segment=db.prepare('INSERT INTO audio_content_segments VALUES(?,?,?)');for(const [id,data] of Object.entries(segments))segment.run(id,source.releaseId,JSON.stringify(data));
 const story=db.prepare('INSERT INTO audio_content_stories VALUES(?,?,?,?,?,?)');for(const s of stories)story.run(s.id,source.releaseId,s.language,s.level,s.title,JSON.stringify(s));
 return true;
}
