import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {initializeDatabase} from '../lib/db-migrations.mjs';

const file = process.env.DATABASE_PATH || './data/slyshat.sqlite';
mkdirSync(dirname(file), {recursive: true});
const db = new DatabaseSync(file);
try {
  const result = initializeDatabase(db);
  const counts = db.prepare('SELECT language,status,count(*) AS count FROM content_stories GROUP BY language,status ORDER BY language,status').all();
  console.log(JSON.stringify({...result, catalog: counts, documents: db.prepare('SELECT count(*) AS count FROM project_documents').get().count}));
} finally { db.close(); }
