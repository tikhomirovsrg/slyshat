const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {test,after}=require('node:test');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-test-'));
process.env.DATABASE_PATH=path.join(dir,'test.sqlite');process.env.APP_URL='http://localhost:3000';process.env.YANDEX_CLIENT_ID='test-client';process.env.YANDEX_CLIENT_SECRET='test-secret';
const {getDb}=require('../lib/db.ts');
const auth=require('../lib/auth.ts');const {saveRecord,snapshot}=require('../lib/progress-store.ts');
const {fresh}=require('../app/learning.ts');const {SyncEngine}=require('../app/sync-engine.ts');
const routes=require('../app/api/progress/route.ts');
const profileRoutes=require('../app/api/profile/route.ts');const {freshProfile}=require('../app/profile-types.ts');
const accounts=new Map();
function user(name){if(accounts.has(name))return accounts.get(name);const token=auth.createSession({yandexId:String(1000+accounts.size),label:name});const request=new Request('http://localhost:3000/api/progress',{headers:{Cookie:auth.SESSION_COOKIE+'='+token}});const account=auth.accountFor(request);const result={account,token};accounts.set(name,result);return result;}
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
function transport(current){const state={online:true,current,drop:false};const request=async(url,options={})=>{
 if(!state.online)throw new Error('offline');const account=state.current.account;
 if(options.method==='POST'){const v=JSON.parse(options.body);if(v.accountId!==account.id)return Response.json({error:'account_changed'},{status:409});const result=saveRecord(account.id,v);if(state.drop){state.drop=false;throw new Error('response lost');}return Response.json({accountId:account.id,...result},{status:result.conflict?409:200});}
 return Response.json({account,...snapshot(account.id)});
};return {state,request};}
function engine(t,storage=memory(),legacy={}){return new SyncEngine(storage,t.request,async()=>legacy,false);}
function update(e,phase){e.update(p=>({...p,started:true,phase}));}

test('OAuth: PKCE, cookie-bound state, expiry and one-time consumption',()=>{
 const flow=auth.beginFlow(),url=new URL(flow.url);assert.equal(url.origin,'https://oauth.yandex.ru');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3000/api/auth/yandex/callback');
 assert.equal(auth.consumeFlow(flow.state,'wrong-cookie'),null);const verifier=auth.consumeFlow(flow.state,flow.state);assert.equal(typeof verifier,'string');assert.equal(auth.consumeFlow(flow.state,flow.state),null);
 const expired=auth.beginFlow();getDb().prepare('UPDATE oauth_flows SET expires_at=0 WHERE state_hash=?').run(auth.hash(expired.state));assert.equal(auth.consumeFlow(expired.state,expired.state),null);
});
test('OAuth exchange uses fixed provider endpoints; allowlist is enforced',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push([url,opts]);return Response.json(calls.length%2?{access_token:'token-only-in-memory'}:{id:'123',login:'sergey',display_name:'Sergey'});};
 process.env.YANDEX_ALLOWED_LOGINS='sergey';assert.deepEqual(await auth.exchangeCode('code','verifier',fetcher),{yandexId:'123',label:'Sergey'});assert.equal(calls[0][1].body.get('code_verifier'),'verifier');assert.equal(calls[1][1].headers.Authorization,'OAuth token-only-in-memory');
 process.env.YANDEX_ALLOWED_LOGINS='someone-else';await assert.rejects(()=>auth.exchangeCode('code','verifier',fetcher));delete process.env.YANDEX_ALLOWED_LOGINS;
});
test('Sessions are opaque, stored hashed, expire, and can be revoked',()=>{
 const u=user('session-user');assert.match(u.token,/^[A-Za-z0-9_-]{43}$/);assert.equal(getDb().prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(u.token),undefined);
 const req=new Request('http://localhost:3000',{headers:{Cookie:auth.SESSION_COOKIE+'='+u.token}});assert.equal(auth.accountFor(req).id,u.account.id);auth.revokeSession(req);assert.equal(auth.accountFor(req),null);
 const t=auth.createSession({yandexId:'9999',label:'expired'});getDb().prepare('UPDATE sessions SET expires_at=0 WHERE token_hash=?').run(auth.hash(t));assert.equal(auth.accountFor(new Request('http://localhost:3000',{headers:{Cookie:auth.SESSION_COOKIE+'='+t}})),null);
});
test('API rejects anonymous requests, foreign origins, another account and bad payloads',async()=>{
 assert.equal((await routes.GET(new Request('http://localhost:3000/api/progress'))).status,401);
 const u=user('api-user'),headers={Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:auth.SESSION_COOKIE+'='+u.token};
 const req=(body,extra={})=>new Request('http://localhost:3000/api/progress',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 assert.equal((await routes.POST(req({}, {Origin:'https://evil.invalid'}))).status,403);
 assert.equal((await routes.POST(req({accountId:'someone-else'}))).status,409);
 assert.equal((await routes.POST(req({accountId:u.account.id,progress:{},baseRevision:0,mutationId:'mutation-0001'}))).status,400);
 assert.equal((await routes.POST(req({accountId:u.account.id,padding:'x'.repeat(70000)}))).status,413);
 const p={...fresh(),started:true};assert.equal((await routes.POST(req({accountId:u.account.id,progress:p,baseRevision:0,mutationId:'mutation-0002'}))).status,200);
 const b=await (await routes.GET(new Request('http://localhost:3000/api/progress',{headers}))).json();assert.equal(b.records[0].progress.started,true);
});
test('Profile API enforces authentication, origin, account ownership, payload limits and revisions',async()=>{
 const url='http://localhost:3000/api/profile';assert.equal((await profileRoutes.GET(new Request(url))).status,401);
 const a=user('profile-api-a'),b=user('profile-api-b'),headers={Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:auth.SESSION_COOKIE+'='+a.token};
 const req=(body,extra={})=>new Request(url,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 const input={accountId:a.account.id,data:{...freshProfile(),goal:'work'},baseRevision:0,mutationId:'profile-api-0001'};
 assert.equal((await profileRoutes.POST(req(input,{Cookie:''}))).status,401);
 assert.equal((await profileRoutes.POST(req(input,{Origin:'https://evil.invalid'}))).status,403);
 assert.equal((await profileRoutes.POST(req(input,{'Content-Type':'text/plain'}))).status,415);
 assert.equal((await profileRoutes.POST(req({...input,accountId:b.account.id}))).status,409);
 assert.equal((await profileRoutes.POST(req({...input,data:{}}))).status,400);
 assert.equal((await profileRoutes.POST(req({...input,padding:'x'.repeat(require('../lib/profile-limits.ts').MAX_PROFILE_REQUEST_BYTES+1)}))).status,413);
 assert.equal((await profileRoutes.POST(req(input))).status,200);
 const retry=await (await profileRoutes.POST(req(input))).json();assert.equal(retry.record.revision,1);
 assert.equal((await profileRoutes.POST(req({...input,mutationId:'profile-api-stale'}))).status,409);
 const own=await (await profileRoutes.GET(new Request(url,{headers}))).json();assert.equal(own.record.data.goal,'work');
 const other=await (await profileRoutes.GET(new Request(url,{headers:{Cookie:auth.SESSION_COOKIE+'='+b.token}}))).json();assert.equal(other.record.revision,0);
});
test('Store isolates users, retries idempotently, and rejects stale revisions',()=>{
 const a=user('store-a'),b=user('store-b'),p={...fresh(),started:true};
 const request={progress:p,baseRevision:0,mutationId:'mutation-store-1'};const first=saveRecord(a.account.id,request);assert.equal(first.record.revision,1);assert.equal(saveRecord(a.account.id,request).record.revision,1);
 assert.equal(snapshot(b.account.id).records.length,0);assert.equal(saveRecord(a.account.id,{...request,mutationId:'mutation-store-2'}).conflict,true);
 assert.equal(snapshot(a.account.id).records[0].revision,1);
});
test('Completion history survives restart of a story and duplicate delivery',()=>{
 const u=user('history');const p={...fresh(),started:true,phase:'done',finishedAt:'2026-10-19T12:00:00.000Z'};
 const saved=saveRecord(u.account.id,{progress:p,baseRevision:0,mutationId:'finished-00001'});saveRecord(u.account.id,{progress:p,baseRevision:0,mutationId:'finished-00001'});
 saveRecord(u.account.id,{progress:fresh(),baseRevision:saved.record.revision,mutationId:'restart-00001'});assert.equal(snapshot(u.account.id).history.length,1);assert.equal(snapshot(u.account.id).records[0].progress.started,false);
});
test('Two devices sync and conflicting progress requires an explicit choice',async()=>{
 const t=transport(user('two-devices')),a=engine(t),b=engine(t);await a.start();await b.start();update(a,'listen');await a.flush();update(b,'decode');await b.flush();
 assert.equal(b.status,'conflict');assert.equal(snapshot(t.state.current.account.id).records[0].progress.phase,'listen');b.resolve('coffee-01','local');await b.flush();await a.refresh();assert.equal(a.p.phase,'decode');assert.equal(a.status,'synced');
});
test('Offline progress survives a new engine and lost responses do not duplicate writes',async()=>{
 const t=transport(user('offline')),store=memory(),a=engine(t,store);await a.start();t.state.online=false;update(a,'dialogue');await a.flush();assert.equal(a.status,'offline');
 t.state.online=true;const b=engine(t,store);await b.start();assert.equal(b.p.phase,'dialogue');await b.flush();assert.equal(b.status,'synced');
 update(b,'transfer');t.state.drop=true;await b.flush();assert.equal(b.status,'offline');const revision=snapshot(t.state.current.account.id).records[0].revision;await b.refresh();await b.flush();assert.equal(snapshot(t.state.current.account.id).records[0].revision,revision);assert.equal(b.status,'synced');
});
test('Edits made during an in-flight save use the acknowledged revision',async()=>{
 const t=transport(user('in-flight'));let release;const original=t.request;let wait=true;
 t.request=async(url,opts)=>{if(opts?.method==='POST'&&wait){wait=false;await new Promise(r=>release=r);}return original(url,opts);};
 const a=engine(t);await a.start();update(a,'listen');const saving=a.flush();update(a,'decode');release();await saving;assert.equal(a.status,'synced');assert.equal(snapshot(t.state.current.account.id).records[0].progress.phase,'decode');
});
test('Account switching never uploads the previous user’s queued state',async()=>{
 const t=transport(user('switch-a')),a=engine(t);await a.start();update(a,'decode');t.state.current=user('switch-b');await a.flush();assert.equal(a.status,'signin');assert.equal(snapshot(t.state.current.account.id).records.length,0);await a.refresh();assert.equal(a.p.started,false);assert.equal(a.account.id,t.state.current.account.id);
});
test('Legacy import is explicit, keeps the old copy, and does not silently overwrite cloud progress',async()=>{
 const t=transport(user('legacy')),legacy={'coffee-01':{...fresh(),started:true,phase:'dialogue'}};const a=engine(t,memory(),legacy);await a.start();assert.equal(a.migrationCount,1);assert.equal(a.p.started,false);update(a,'listen');await a.flush();a.importLegacy();assert.equal(a.status,'conflict');assert.equal(a.migrationCount,0);assert.equal(legacy['coffee-01'].phase,'dialogue');a.resolve('coffee-01','remote');assert.equal(a.p.phase,'listen');
});
after(()=>{getDb().close();fs.rmSync(dir,{recursive:true,force:true});});
