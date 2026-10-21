const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {previewOptions,previewHref,resolvePreviewStory}=require('../lib/preview-options.ts');
const {PreviewProfileStore,PREVIEW_PROFILE_KEY}=require('../app/use-preview-profile.ts');
const {freshProfile}=require('../app/profile-types.ts');

test('Preview is opt-in and story links stay local with a bounded story ID',()=>{
 for(const query of ['','?preview=0','?preview=true','?story=coffee-it'])assert.equal(previewOptions(query),null);
 assert.deepEqual(previewOptions('?preview=1&lang=it&story=coffee-it'),{language:'it',storyId:'coffee-it'});
 assert.deepEqual(previewOptions('?preview=1&lang=unknown&story=https://example.com'),{language:'en',storyId:null});
 assert.equal(previewOptions('?preview=1&story='+'a'.repeat(121)).storyId,null);
 assert.equal(previewHref({language:'it',storyId:'coffee-it'}),'/?preview=1&lang=it&story=coffee-it');
});

test('A direct story link resolves its actual language through the public endpoint without cookies',async()=>{
 const signal=new AbortController().signal,calls=[];
 const options={language:'en',storyId:'coffee-it'};
 const result=await resolvePreviewStory(options,signal,async(url,init)=>{calls.push({url,init});return Response.json({id:'coffee-it',language:'it'});});
 assert.deepEqual(result,{language:'it',storyId:'coffee-it'});
 assert.equal(calls[0].url,'/api/stories?id=coffee-it');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.signal,signal);
 await assert.rejects(resolvePreviewStory(options,signal,async()=>new Response('',{status:404})),/не найдена/);
 await assert.rejects(resolvePreviewStory(options,signal,async()=>Response.json({id:'another',language:'it'})),/прочитать/);
 assert.deepEqual(await resolvePreviewStory({language:'it',storyId:null},signal,()=>{throw Error('No fetch expected');}),{language:'it',storyId:null});
});

test('Preview persists and resets only its isolated profile; account data is untouched',()=>{
 const accountKey='slyshat-profile-v1:real-account',rows=new Map([[accountKey,'private account profile'],['slyshat-cloud-last','real-account']]);
 const writes=[],reads=[],storage={getItem:key=>{reads.push(key);return rows.get(key)||null;},setItem:(key,value)=>{writes.push(key);rows.set(key,value);}};
 const preview=new PreviewProfileStore(storage);preview.start();
 const at='2026-10-21T12:00:00.000Z';
 preview.update(data=>({...data,journey:{active:{it:'coffee-it'},stories:{'coffee-it':{path:[0],heard:['start'],assisted:[],finishedAt:null,updatedAt:at}}}}));
 const restored=new PreviewProfileStore(storage);restored.start();assert.deepEqual(restored.data,preview.data);
 restored.reset();assert.deepEqual(restored.data,freshProfile());
 assert.equal(rows.get(accountKey),'private account profile');assert.equal(rows.get('slyshat-cloud-last'),'real-account');
 assert.deepEqual([...new Set([...reads,...writes])],[PREVIEW_PROFILE_KEY]);
 assert.equal(restored.snapshot().previewSaveNote,'Тестовый прогресс сохранён в этой вкладке');
});

test('Blocked or damaged preview storage keeps the preview usable without a false saved claim',()=>{
 const blocked=new PreviewProfileStore({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});blocked.start();
 assert.equal(blocked.ready,true);blocked.update(data=>({...data,goal:'travel'}));assert.equal(blocked.data.goal,'travel');assert.equal(blocked.storageAvailable,false);
 assert.equal(blocked.snapshot().previewSaveNote,'Тестовый прогресс доступен до закрытия страницы');
 let raw='{bad json';const damaged=new PreviewProfileStore({getItem:()=>raw,setItem:(_,value)=>{raw=value;}});damaged.start();
 assert.deepEqual(damaged.data,freshProfile());assert.deepEqual(JSON.parse(raw),freshProfile());
});

test('The preview branch never mounts account hooks, even when an account could be signed in',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const progress=require('../app/use-study-progress.ts'),profile=require('../app/use-profile.ts');
 const savedProgress=progress.useStudyProgress,savedProfile=profile.useProfile,savedState=React.useState;
 const Home=require('../app/page.tsx').default;
 progress.useStudyProgress=profile.useProfile=()=>{throw Error('Account hook mounted');};
 try{
  React.useState=initial=>initial===null?[{language:'it',storyId:'coffee-it'},()=>{}]:savedState(initial);
  const html=renderToStaticMarkup(React.createElement(Home));assert(html.includes('Тестовый просмотр'));assert(!html.includes('Войти через Яндекс'));
  React.useState=initial=>initial===null?[false,()=>{}]:savedState(initial);
  assert.throws(()=>renderToStaticMarkup(React.createElement(Home)),/Account hook mounted/);
 }finally{progress.useStudyProgress=savedProgress;profile.useProfile=savedProfile;React.useState=savedState;}
});
