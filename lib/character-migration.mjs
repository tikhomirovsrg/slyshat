import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {characterHash, characterSources, validateCharacterCast} from './character-cast.mjs';

// Called inside initializeDatabase's transaction. Published comic boards,
// course entries and every user-owned table remain byte-for-byte untouched.
export function migrateCharacters(db, path = resolve(process.cwd(), 'content/characters/cast-v1.json')) {
  const bytes = readFileSync(path), checksum = characterHash(bytes), release = JSON.parse(bytes);
  db.exec(`CREATE TABLE IF NOT EXISTS character_cast_releases(id TEXT PRIMARY KEY, checksum TEXT NOT NULL, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)), applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS story_character_cast(story_id TEXT PRIMARY KEY, release_id TEXT NOT NULL REFERENCES character_cast_releases(id), data_json TEXT NOT NULL CHECK(json_valid(data_json)));`);
  const applied = db.prepare('SELECT checksum FROM character_cast_releases WHERE id=?').get(release.releaseId);
  if (applied) {
    if (applied.checksum !== checksum) throw Error('Character cast changed: use a new releaseId.');
    return false;
  }
  validateCharacterCast(release, characterSources(db));
  const {stories, ...metadata} = release;
  db.prepare('INSERT INTO character_cast_releases VALUES(?,?,?,?)').run(release.releaseId, checksum, JSON.stringify(metadata), new Date().toISOString());
  const insert = db.prepare('INSERT INTO story_character_cast VALUES(?,?,?)');
  for (const [id, cast] of Object.entries(stories)) insert.run(id, release.releaseId, JSON.stringify(cast));
  return true;
}
