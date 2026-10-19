const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),{execFileSync}=require('node:child_process');
const {initializeDatabase}=require('../lib/db-migrations.mjs');
const root=path.resolve(__dirname,'..'),seedFile=path.join(root,'content/catalog-v1.json');
const seed=JSON.parse(fs.readFileSync(seedFile,'utf8'));

test('Fresh database stores 100 stories per language, full available content, drafts and roadmap',()=>{
 const db=new DatabaseSync(':memory:');try{
  assert.equal(initializeDatabase(db).seeded,true);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);
  for(const language of ['en','it']){
   assert.equal(db.prepare('SELECT count(*) n FROM content_stories WHERE language=?').get(language).n,100);
   assert.equal(db.prepare("SELECT count(*) n FROM content_stories WHERE language=? AND status='available'").get(language).n,20);
   for(const [level,n] of Object.entries({A1:20,A2:30,B1:30,B2:15,C1:5}))assert.equal(db.prepare('SELECT count(*) n FROM content_stories WHERE language=? AND target_level=?').get(language,level).n,n);
  }
  for(const s of seed.stories){const r=db.prepare('SELECT * FROM content_stories WHERE id=?').get(s.id);assert.deepEqual(JSON.parse(r.content_json),s.content);assert.deepEqual(JSON.parse(r.practice_json),s.practice);assert.deepEqual(JSON.parse(r.brief_json),s.brief);assert.equal(r.listening_level,null);}
  assert.equal(db.prepare("SELECT count(*) n FROM content_stories WHERE status='planned' AND content_json IS NULL AND practice_json IS NULL").get().n,160);
  assert.equal(db.prepare('SELECT markdown FROM project_documents').get().markdown,seed.documents[0].markdown);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,0);
 }finally{db.close();}
});

test('Repeated seeding preserves editorial changes and does not duplicate catalog or roadmap',()=>{
 const db=new DatabaseSync(':memory:');try{
  initializeDatabase(db);db.prepare('UPDATE content_stories SET title=? WHERE id=?').run('Редакторская правка','coffee-01');
  db.prepare('UPDATE project_documents SET markdown=?').run('Уточнённый план');
  const before=db.prepare('SELECT * FROM content_seed_versions').all();
  assert.equal(initializeDatabase(db).seeded,false);
  assert.equal(db.prepare('SELECT count(*) n FROM content_stories').get().n,200);
  assert.equal(db.prepare('SELECT count(*) n FROM project_documents').get().n,1);
  assert.equal(db.prepare('SELECT title FROM content_stories WHERE id=?').get('coffee-01').title,'Редакторская правка');
  assert.equal(db.prepare('SELECT markdown FROM project_documents').get().markdown,'Уточнённый план');
  assert.deepEqual(db.prepare('SELECT * FROM content_seed_versions').all(),before);
 }finally{db.close();}
});

test('v2 upgrade preserves profile drafts, progress revisions and account records byte for byte',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec(fs.readFileSync(path.join(__dirname,'fixtures/schema-v1.sql'),'utf8'));
  db.exec('CREATE TABLE study_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, revision INTEGER NOT NULL, mutation_id TEXT NOT NULL, updated_at TEXT NOT NULL); PRAGMA user_version=2;');
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u','yandex','Learner','2026-01-01');
  db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run('u','coffee-01','{"practice":{"draft":"Мой черновик"}}',9,'m1','2026-01-02');
  db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?)').run('u','{"goal":"work","level":"A2"}',4,'p1','2026-01-02');
  const tables=['users','sessions','oauth_flows','progress','runs','study_profiles'];const before=tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());
  initializeDatabase(db);assert.deepEqual(tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all()),before);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,3);
 }finally{db.close();}
});

test('Invalid content rolls back schema and inserted rows; changed seed requires a new version',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-content-'));const file=path.join(dir,'invalid.json');const db=new DatabaseSync(':memory:');
 try{
  const invalid=structuredClone(seed);invalid.stories.at(-1).targetLevel='INVALID';fs.writeFileSync(file,JSON.stringify(invalid));
  assert.throws(()=>initializeDatabase(db,file),/CHECK constraint/);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,0);
  initializeDatabase(db);const changed=structuredClone(seed);changed.stories[0].title='Unexpected rewrite';fs.writeFileSync(file,JSON.stringify(changed));
  assert.throws(()=>initializeDatabase(db,file),/new seedId/);
  assert.equal(db.prepare('SELECT title FROM content_stories WHERE id=?').get(seed.stories[0].id).title,seed.stories[0].title);
  db.exec('PRAGMA user_version=99');assert.throws(()=>initializeDatabase(db),/newer/);assert.equal(db.prepare('PRAGMA user_version').get().user_version,99);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('Migration CLI survives process restarts and seeds the persistent database once',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-cli-'));const file=path.join(dir,'nested','db.sqlite');
 try{
  const run=()=>JSON.parse(execFileSync(process.execPath,['scripts/migrate.mjs'],{cwd:root,env:{...process.env,DATABASE_PATH:file},encoding:'utf8'}));
  assert.equal(run().seeded,true);assert.equal(run().seeded,false);
  const db=new DatabaseSync(file);try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(db.prepare('SELECT count(*) n FROM content_seed_versions').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM content_stories').get().n,200);}finally{db.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
