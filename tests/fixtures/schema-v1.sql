-- Schema from the previously delivered v1 Docker bundle.
BEGIN IMMEDIATE;
    CREATE TABLE users (id TEXT PRIMARY KEY, yandex_id TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX sessions_user ON sessions(user_id);
    CREATE TABLE oauth_flows (state_hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE progress (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, episode TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL, mutation_id TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,episode));
    CREATE TABLE runs (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, episode TEXT NOT NULL, finished_at TEXT NOT NULL, correct INTEGER NOT NULL, independent INTEGER NOT NULL, total INTEGER NOT NULL, PRIMARY KEY(user_id,episode,finished_at));
    PRAGMA user_version=1;
    COMMIT;
