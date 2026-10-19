const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {fresh,validateProgress,validateCollection,resultFor,storageKey,saveProgress,loadProgress}=require('../app/learning.ts');
const {episodes}=require('../app/episodes.ts');
let routes=0,nodeCount=0;
const allTransferIds=new Set();
assert.equal(episodes.length,40);
assert.equal(episodes.filter(e=>e.language==='en').length,20);
assert.equal(episodes.filter(e=>e.language==='it').length,20);
const keys=new Set();
assert.equal(new Set(episodes.map(e=>e.id)).size,40);
assert.equal(new Set(episodes.map(e=>e.title)).size,40);
assert.equal(new Set(episodes.map(e=>e.opening)).size,40);
for(const lang of ['en','it'])assert.deepEqual(episodes.filter(e=>e.language===lang).map(e=>e.number).sort(),Array.from({length:20},(_,i)=>String(i+1).padStart(2,'0')));
for(const e of episodes){
 const visited=new Set(),outcomes=new Set();let paths=0;
 function walk(id,trail=[]){
  assert(Object.hasOwn(e.nodes,id),`${e.id}: missing node ${id}`);assert(!trail.includes(id),`${e.id}: cycle at ${id}`);
  visited.add(id);const n=e.nodes[id];assert(n.text&&n.ru&&n.speaker);assert.equal(n.speaker,e.mainSpeaker.id);
  if(n.outcome){assert.equal(n.choices.length,0);assert(e.outcomes[n.outcome]);outcomes.add(n.outcome);paths++;return;}
  assert(n.choices.length>0,`${e.id}: dead end ${id}`);
  for(const c of n.choices){assert(c.label&&c.text);walk(c.next,[...trail,id]);}
 }
 walk('start');assert.equal(visited.size,Object.keys(e.nodes).length);assert.deepEqual([...outcomes].sort(),Object.keys(e.outcomes).sort());assert.equal(outcomes.size,3);
 assert.equal(e.transfer.length,3);assert.equal(new Set(e.transfer.map(t=>t.id)).size,3);
 for(const t of e.transfer){assert(!allTransferIds.has(t.id),`${e.id}: transfer id collision`);allTransferIds.add(t.id);}
 for(const key of ['title','category','summary','duration','contextTitle','contextText','taskTitle','taskText','taskShort','skill','transferIntro','repair','checkText','opening','openingRu'])assert(typeof e[key]==='string'&&e[key].trim(),`${e.id}: missing ${key}`);assert.equal(e.phraseLabels.length,3);assert(e.phrases.length>=3);
 assert.equal(new Set(e.phrases.map(f=>f.id)).size,e.phrases.length);
 for(const f of e.phrases)for(const key of ['text','ru','part','why','sound','example','exampleRu'])assert(f[key],`${e.id}: incomplete phrase`);
 for(const q of e.transfer){assert.equal(q.options.length,3);assert.equal(new Set(q.options).size,3);assert(Number.isInteger(q.answer));assert(q.options[q.answer]);assert(q.text&&q.ru&&q.explanation);assert.equal(q.speaker,e.secondSpeaker.id);}
 assert(e.openingQuestion.options[e.openingQuestion.answer]);
 assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(fresh(e.id)))),fresh(e.id));
 assert.throws(()=>validateProgress({...fresh(e.id),node:'__proto__'}));
 assert.throws(()=>validateProgress({...fresh(e.id),saved:['unknown']}));
 assert.throws(()=>validateProgress({...fresh(e.id),outcome:'unknown'}));
 assert.equal(e.locale.startsWith(e.language),true);
 keys.add(storageKey(e.id));routes+=paths;nodeCount+=visited.size;
 console.log(`${e.id}: ${visited.size} nodes, ${paths} routes, 3 endings`);
}
assert.equal(keys.size,40);assert.equal(storageKey('coffee-01'),'slyshat-progress-v1');
const old={...fresh(),started:true,phase:'dialogue',node:'landmark',saved:['still-on'],history:[{node:'short',reply:'Is the cafe next to the bookshop?'}]};
const migrated=validateCollection(JSON.parse(JSON.stringify(old)));assert.deepEqual(migrated.progress['coffee-01'],old);
const backup={kind:'slyshat-collection',version:2,active:'coffee-it',progress:Object.fromEntries(episodes.map(e=>[e.id,fresh(e.id)]))};
assert.deepEqual(validateCollection(JSON.parse(JSON.stringify(backup))),backup);
assert.throws(()=>validateCollection({...backup,active:'unknown'}));
assert.throws(()=>validateCollection({...backup,progress:{'train-it':fresh('work-en')}}));
assert.throws(()=>validateProgress({...fresh(),phraseIndex:99}));
assert.throws(()=>validateProgress({...fresh(),attempts:{opening:{plays:-1,text:false,translation:false}}}));
assert.equal(resultFor(0,0).withoutText,false);
assert.equal(resultFor(0,0,{plays:0,text:true,translation:false}).listened,false);
assert.equal(resultFor(0,0,{plays:1,text:false,translation:false}).firstListen,true);
assert.equal(resultFor(0,0,{plays:2,text:false,translation:false}).firstListen,false);
assert.equal(resultFor(0,0,{plays:1,text:false,translation:true}).withoutText,false);
assert.equal(resultFor(0,0,{plays:1,text:true,translation:false}).withoutText,false);
assert.equal(resultFor(1,0,{plays:1,text:false,translation:false}).correct,false);
(async()=>{
 const memory=new Map();global.window={};global.localStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)||null};
 memory.set('slyshat-progress-v1',JSON.stringify(old));assert.deepEqual(await loadProgress(),old);
 const italian={...fresh('coffee-it'),started:true,phase:'decode',saved:['ti-va']};
 const work={...fresh('work-en'),started:true,phase:'dialogue',node:'split'};
 await saveProgress(italian);await saveProgress(work);
 assert.deepEqual(await loadProgress('coffee-it'),italian);assert.deepEqual(await loadProgress('work-en'),work);assert.deepEqual(await loadProgress('coffee-01'),old);
 assert.equal(await loadProgress('train-it'),null);
 console.log(`PASS: ${episodes.length} stories, ${nodeCount} nodes, ${routes} routes. Old-save migration, cross-story isolation, backup import/export, and assistance scoring verified.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
