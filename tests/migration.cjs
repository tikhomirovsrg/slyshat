const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);

test('Schema v1 upgrades to v5 preserving accounts, sessions, story data and completion history',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-migration-'));process.env.DATABASE_PATH=path.join(dir,'v1.sqlite');
 let db=new DatabaseSync(process.env.DATABASE_PATH);
 try{
  db.exec(fs.readFileSync(path.join(__dirname,'fixtures/schema-v1.sql'),'utf8'));
  const {fresh}=require('../app/learning.ts'),old=fresh();delete old.practice;old.started=true;old.phase='dialogue';
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('old-user','1234','Existing learner','2026-01-01T00:00:00.000Z');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('hashed-session','old-user',2000000000);
  db.prepare('INSERT INTO oauth_flows VALUES(?,?,?)').run('hashed-state','pkce-verifier',2000000000);
  db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run('old-user',old.episode,JSON.stringify(old),7,'old-mutation','2026-01-02T00:00:00.000Z');
  db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run('old-user',old.episode,'2026-01-01T01:00:00.000Z',2,1,3);
  const tables=['users','sessions','oauth_flows','progress','runs'];const before=tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());
  db.close();db=require('../lib/db.ts').getDb();
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);
  assert.deepEqual(tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all()),before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM study_profiles').get().n,0);
  const record=require('../lib/progress-store.ts').snapshot('old-user').records[0];
  assert.equal(record.revision,7);assert.equal(record.progress.phase,'dialogue');assert.deepEqual(record.progress.practice,fresh().practice);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
