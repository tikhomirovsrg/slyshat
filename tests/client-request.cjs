const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {requestJson}=require('../lib/client-request.ts'),{SyncEngine}=require('../app/sync-engine.ts'),{ProfileSync}=require('../app/use-profile.ts'),{freshProfile}=require('../app/profile-types.ts');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
// Native browser fetch rejects a SyncEngine/ProfileSync instance as its receiver.
function browserFetch(reply){return async function(url,options){'use strict';assert.equal(this,globalThis,'Illegal invocation: expected the browser global');return reply(url,options);};}
test('Anonymous first visit reaches sign-in when fetch checks its receiver',async()=>{
 const engine=new SyncEngine(storage(),browserFetch(()=>Response.json({error:'signin',oauthReady:true},{status:401})),async()=>({}),false);
 await engine.start();assert.equal(engine.status,'signin');assert.equal(engine.oauthReady,true);assert.equal(engine.account,null);engine.stop();
});
test('Both progress engines read and save with a browser-compatible fetch receiver',async()=>{
 const account={id:'browser-account',label:'Learner'};let posts=0;
 const request=browserFetch((url,options)=>{
  if(options.method==='POST'){posts++;const input=JSON.parse(options.body);return Response.json({accountId:account.id,record:{...(url==='/api/profile'?{data:input.data}:{progress:input.progress}),revision:1,mutationId:input.mutationId,updatedAt:'2026-10-21'}});}
  return Response.json(url==='/api/profile'?{accountId:account.id,record:{data:freshProfile(),revision:0,mutationId:'',updatedAt:''}}:{account,records:[],history:[]});
 });
 const progress=new SyncEngine(storage(),request,async()=>({}),false),profile=new ProfileSync(account.id,storage(),request,()=>{},false);
 await progress.start();await profile.start();assert.equal(progress.status,'synced');assert.equal(profile.status,'synced');
 progress.update(p=>({...p,started:true}));profile.update(p=>({...p,goal:'travel'}));await progress.flush();await profile.flush();
 assert.equal(posts,2);assert.equal(progress.status,'synced');assert.equal(profile.status,'synced');progress.stop();profile.stop();
});
test('Phone without AbortSignal.timeout can read JSON; timeout includes the response body',async()=>{
 const original=AbortSignal.timeout;AbortSignal.timeout=undefined;
 try{
  const result=await requestJson(browserFetch(()=>Response.json({ok:true})),'/api/progress');assert.equal(result.data.ok,true);
  let signal;const pending=browserFetch((_url,options)=>{signal=options.signal;return {json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('timeout')),{once:true}))};});
  await assert.rejects(requestJson(pending,'/api/progress',{},10),/timeout/);assert(signal.aborted);
 }finally{AbortSignal.timeout=original;}
});
test('Failed initial check keeps a direct Yandex entry point and retry visible',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{LoginScreen}=require('../app/account-panel.tsx');
 const html=renderToStaticMarkup(React.createElement(LoginScreen,{sync:{status:'offline',oauthReady:false,refresh(){}}}));
 assert(html.includes('href="/api/auth/yandex"'));assert(html.includes('Повторить проверку'));assert(!html.includes('Вход пока не настроен'));
});
