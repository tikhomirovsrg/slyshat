import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export const SCHEMA_VERSION = 4;

// Shared by the container entrypoint and the application. No user data is seeded.
export function initializeDatabase(db, seedPath = resolve(process.cwd(), 'content/catalog-v1.json'), practicePath = resolve(process.cwd(), 'content/practice-v2.json')) {
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const bytes = readFileSync(seedPath);
  const seed = JSON.parse(bytes.toString('utf8'));
  if (seed.formatVersion !== 1 || !seed.seedId || !Array.isArray(seed.stories) || !Array.isArray(seed.documents)) throw new Error('Invalid content seed.');
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const practiceBytes = readFileSync(practicePath);
  const practice = JSON.parse(practiceBytes.toString('utf8'));
  if (practice.formatVersion !== 1 || !practice.releaseId || !Array.isArray(practice.sets) || !practice.publishedAt) throw new Error('Invalid practice release.');
  const practiceChecksum = createHash('sha256').update(practiceBytes).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    // Read inside the write lock: concurrent app starts cannot apply the same migration twice.
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (version > SCHEMA_VERSION) throw new Error('Database is newer than this application.');
    if (version === 0) db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, yandex_id TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE INDEX sessions_user ON sessions(user_id);
      CREATE TABLE oauth_flows (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, episode TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL, mutation_id TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,episode));
      CREATE TABLE runs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, episode TEXT NOT NULL, finished_at TEXT NOT NULL, correct INTEGER NOT NULL, independent INTEGER NOT NULL, total INTEGER NOT NULL, PRIMARY KEY(user_id,episode,finished_at));
    `);
    if (version < 2) db.exec(`
      CREATE TABLE study_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, mutation_id TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
    if (version < 3) db.exec(`
      CREATE TABLE content_stories (
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL CHECK (language IN ('en','it')),
        title TEXT NOT NULL,
        target_level TEXT NOT NULL CHECK (target_level IN ('A1','A2','B1','B2','C1')),
        practice_level TEXT CHECK (practice_level IN ('A1','A2','B1','B2','C1')),
        listening_level TEXT CHECK (listening_level IN ('A1','A2','B1','B2','C1')),
        status TEXT NOT NULL CHECK (status IN ('available','planned')),
        release_number INTEGER NOT NULL CHECK (release_number BETWEEN 0 AND 8),
        series TEXT NOT NULL,
        learning_goal TEXT NOT NULL,
        brief_json TEXT NOT NULL CHECK (json_valid(brief_json)),
        content_json TEXT CHECK (content_json IS NULL OR json_valid(content_json)),
        practice_json TEXT CHECK (practice_json IS NULL OR json_valid(practice_json)),
        content_version INTEGER NOT NULL CHECK (content_version > 0),
        updated_at TEXT NOT NULL,
        CHECK (status <> 'available' OR (content_json IS NOT NULL AND practice_json IS NOT NULL))
      );
      CREATE INDEX content_stories_catalog ON content_stories(language, status, target_level);
      CREATE TABLE project_documents (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, markdown TEXT NOT NULL,
        metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
        version INTEGER NOT NULL CHECK (version > 0), updated_at TEXT NOT NULL
      );
      CREATE TABLE content_seed_versions (
        id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL,
        story_count INTEGER NOT NULL, document_count INTEGER NOT NULL
      );
    `);
    const applied = db.prepare('SELECT checksum FROM content_seed_versions WHERE id=?').get(seed.seedId);
    if (applied && applied.checksum !== checksum) throw new Error('Content seed changed without a new seedId. Create a versioned content migration.');
    if (!applied) {
      const insertStory = db.prepare(`INSERT INTO content_stories
        (id,language,title,target_level,practice_level,listening_level,status,release_number,series,learning_goal,brief_json,content_json,practice_json,content_version,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
      for (const story of seed.stories) insertStory.run(
        story.id, story.language, story.title, story.targetLevel, story.practiceLevel, story.listeningLevel,
        story.status, story.releaseNumber, story.series, story.learningGoal, JSON.stringify(story.brief),
        story.content === null ? null : JSON.stringify(story.content),
        story.practice === null ? null : JSON.stringify(story.practice), story.contentVersion, seed.updatedAt
      );
      const insertDocument = db.prepare('INSERT INTO project_documents(id,title,markdown,metadata_json,version,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING');
      for (const doc of seed.documents) insertDocument.run(doc.id, doc.title, doc.markdown, JSON.stringify(doc.metadata), doc.version, seed.updatedAt);
      db.prepare('INSERT INTO content_seed_versions VALUES (?,?,?,?,?)').run(seed.seedId, checksum, new Date().toISOString(), seed.stories.length, seed.documents.length);
    }
    if (version < 4) db.exec(`
      CREATE TABLE content_practice_releases (
        id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL,
        set_count INTEGER NOT NULL, question_count INTEGER NOT NULL
      );
      CREATE TABLE content_practice_sets (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL REFERENCES content_stories(id),
        release_id TEXT NOT NULL REFERENCES content_practice_releases(id),
        data_json TEXT NOT NULL CHECK (json_valid(data_json)),
        updated_at TEXT NOT NULL
      );
      CREATE INDEX content_practice_sets_story ON content_practice_sets(story_id);
    `);
    const practiceApplied = db.prepare('SELECT checksum FROM content_practice_releases WHERE id=?').get(practice.releaseId);
    if (practiceApplied && practiceApplied.checksum !== practiceChecksum) throw new Error('Practice release changed without a new releaseId.');
    if (!practiceApplied) {
      const seenQuestions = new Set();
      for (const set of practice.sets) {
        const story = db.prepare('SELECT language,practice_level,status FROM content_stories WHERE id=?').get(set.episode);
        if (!set.id || !story || story.status !== 'available' || story.language !== set.language || story.practice_level !== set.level || !Array.isArray(set.questions) || set.questions.length === 0) throw new Error('Invalid practice story reference.');
        for (const q of set.questions) {
          if (!q.id || seenQuestions.has(q.id) || !q.prompt || !q.answer || !q.explanation) throw new Error('Invalid practice question.');
          seenQuestions.add(q.id);
        }
      }
      db.prepare('INSERT INTO content_practice_releases VALUES (?,?,?,?,?)').run(practice.releaseId, practiceChecksum, new Date().toISOString(), practice.sets.length, seenQuestions.size);
      const insertSet = db.prepare('INSERT INTO content_practice_sets VALUES (?,?,?,?,?)');
      for (const set of practice.sets) insertSet.run(set.id, set.episode, practice.releaseId, JSON.stringify(set), practice.publishedAt);
    }
    db.exec(`PRAGMA user_version=${SCHEMA_VERSION}; COMMIT;`);
    return {schemaVersion: SCHEMA_VERSION, seeded: !applied, practiceSeeded: !practiceApplied};
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
