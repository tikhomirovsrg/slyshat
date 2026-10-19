import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initializeDatabase } from './db-migrations.mjs';

let database: DatabaseSync | undefined;
export function getDb(): DatabaseSync {
  if (database) return database;
  const file = process.env.DATABASE_PATH || './data/slyshat.sqlite';
  mkdirSync(dirname(file), {recursive:true});
  const db = new DatabaseSync(file);
  try { initializeDatabase(db); } catch (error) { db.close(); throw error; }
  database=db;
  return db;
}
