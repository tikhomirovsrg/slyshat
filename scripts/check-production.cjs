const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const root=path.resolve(__dirname,'..'),standalone=path.join(root,'.next/standalone');
if(!fs.existsSync(path.join(standalone,'server.js')))throw new Error('Run npm run build first.');
fs.cpSync(path.join(root,'.next/static'),path.join(standalone,'.next/static'),{recursive:true});fs.cpSync(path.join(root,'public'),path.join(standalone,'public'),{recursive:true});
// Mirror the runner-stage COPY instructions and exercise its real entrypoint.
for(const file of ['content/catalog-v1.json','content/practice-v2.json','lib/db-migrations.mjs','scripts/migrate.mjs','scripts/docker-entrypoint.sh']){const dest=path.join(standalone,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-http-'));
process.env.DATABASE_PATH=path.join(dir,'live.sqlite');process.env.APP_URL='http://localhost:3217';
const {freshProfile}=require('../app/profile-types.ts');
const {createSession,SESSION_COOKIE}=require('../lib/auth.ts'),{fresh}=require('../app/learning.ts'),{getDb}=require('../lib/db.ts');
let child;let output='';
async function start(){
 child=spawn('sh',['scripts/docker-entrypoint.sh','node','server.js'],{cwd:standalone,env:{...process.env,PORT:'3217',HOSTNAME:'127.0.0.1',NEXT_TELEMETRY_DISABLED:'1',YANDEX_CLIENT_ID:'',YANDEX_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>output+=s);
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('Server exited: '+output);try{const r=await fetch('http://127.0.0.1:3217/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Server did not become ready: '+output);
}
async function stop(){if(!child||child.exitCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}
const request=(route,options={})=>fetch('http://127.0.0.1:3217'+route,{redirect:'manual',...options});
(async()=>{
 try{
  await start();let r=await request('/');assert.equal(r.status,200);const html=await r.text();assert(html.includes('Слышать'));assert.equal((await request('/favicon.svg')).status,200);
  assert.equal((await request('/api/progress')).status,401);assert.equal((await request('/api/profile')).status,401);
  r=await request('/api/auth/yandex/callback?state=invalid&code=unused');assert.equal(r.status,307);assert(r.headers.get('location').endsWith('?auth_error=failed'));
  const token=createSession({yandexId:'99123',label:'HTTP test'}),cookie=SESSION_COOKIE+'='+token;
  let snapshot=await (await request('/api/progress',{headers:{Cookie:cookie}})).json();assert(snapshot.account.id);assert.equal(snapshot.records.length,0);
  const state={...fresh('coffee-it'),started:true,phase:'dialogue'};const {extraQuestions}=require('../app/extra-practice.ts');const extra=extraQuestions('coffee-it');for(const q of extra)state.practice.answers[q.id]={value:q.answer,correct:true,checkedAt:new Date().toISOString(),...(q.audio?{listened:true,assisted:q===extra[0]}:{})};state.practice.draft='Il mio testo viene salvato sul server.';
  r=await request('/api/progress',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({accountId:snapshot.account.id,progress:state,baseRevision:0,mutationId:'http-mutation-001'})});assert.equal(r.status,200);
  r=await request('/api/profile',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL,'Content-Type':'application/json'},body:JSON.stringify({accountId:snapshot.account.id,data:{...freshProfile(),goal:'work'},baseRevision:0,mutationId:'profile-http-001'})});assert.equal(r.status,200);
  const second=SESSION_COOKIE+'='+createSession({yandexId:'99123',label:'HTTP test'});
  await stop();await start();snapshot=await (await request('/api/progress',{headers:{Cookie:second}})).json();assert.equal(snapshot.records[0].progress.phase,'dialogue');assert.deepEqual(snapshot.records[0].progress.practice,state.practice);const profile=await (await request('/api/profile',{headers:{Cookie:second}})).json();assert.equal(profile.record.data.goal,'work');
  r=await request('/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:process.env.APP_URL}});assert.equal(r.status,303);assert.equal((await request('/api/progress',{headers:{Cookie:cookie}})).status,401);assert.equal((await request('/api/progress',{headers:{Cookie:second}})).status,200);
  const backup=execFileSync(process.execPath,[path.join(root,'scripts/backup.mjs')],{env:process.env,maxBuffer:10*1024*1024});assert.equal(backup.subarray(0,15).toString(),'SQLite format 3');
  const restored=path.join(dir,'restored.sqlite');execFileSync(process.execPath,[path.join(root,'scripts/restore.mjs'),'--confirm-app-stopped'],{env:{...process.env,DATABASE_PATH:restored},input:backup});
  const {DatabaseSync}=require('node:sqlite');let db=new DatabaseSync(restored);assert.equal(db.prepare('SELECT count(*) AS n FROM progress').get().n,1);assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);assert.equal(db.prepare('SELECT count(*) AS n FROM study_profiles').get().n,1);assert.equal(JSON.parse(db.prepare('SELECT data FROM study_profiles').get().data).goal,'work');db.close();
  db=new DatabaseSync(restored);assert.equal(db.prepare('SELECT count(*) n FROM content_stories').get().n,200);assert.equal(db.prepare('SELECT count(*) n FROM project_documents').get().n,1);assert.equal(db.prepare('PRAGMA user_version').get().user_version,4);assert.equal(db.prepare('SELECT count(*) n FROM content_practice_sets').get().n,80);assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM progress').get().data).practice,state.practice);db.close();
  execFileSync(process.execPath,[path.join(root,'scripts/restore.mjs'),'--confirm-app-stopped','--archive-existing'],{env:{...process.env,DATABASE_PATH:restored},input:backup});assert(fs.readdirSync(dir).some(n=>n.startsWith('restored.sqlite.before-restore-')));
  console.log('PASS: production HTTP, anonymous access denied, story, draft and profile save/load across sessions, persistence after restart, logout isolation, online backup, validated restore and previous-database preservation.');
 }finally{await stop();getDb().close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
