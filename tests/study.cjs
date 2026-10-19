const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {test,after}=require('node:test');const {DatabaseSync}=require('node:sqlite');const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {episodes}=require('../app/episodes.ts'),{packs,getPack}=require('../app/packs.ts');const {levels,wordCount,isCorrect,nextReview}=require('../app/study-types.ts');const {fresh,validateProgress,validateCollection,resultFor}=require('../app/learning.ts');const {lessonScore,testQuestions,recommendedLevel,skillStats}=require('../app/study.ts');const {freshProfile,validateProfile,activityStats}=require('../app/profile-types.ts');const {ProfileSync}=require('../app/use-profile.ts');
const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'slyshat-study-'));process.env.DATABASE_PATH=path.join(dir,'study.sqlite');
const {getDb}=require('../lib/db.ts');const db=getDb();const actualStore=require('../lib/profile-store.ts').profileStore();
const seed=id=>db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?)').run(id,id,id,new Date().toISOString());
const store={get(id){seed(id);return actualStore.get(id);},save(id,input){seed(id);return actualStore.save(id,input);}};
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
function transport(id){const state={id,online:true,drop:false};const request=async(url,options={})=>{if(!state.online)throw Error('offline');if(options.method==='POST'){const v=JSON.parse(options.body);if(v.accountId!==state.id)return Response.json({error:'account_changed'},{status:409});const result=await store.save(state.id,v);if(state.drop){state.drop=false;throw Error('response lost');}return Response.json({accountId:state.id,...result},{status:result.conflict?409:200});}return Response.json({accountId:state.id,record:await store.get(state.id)});};return {state,request};}
const profile=(t,s=memory())=>new ProfileSync(t.state.id,s,t.request,()=>{},false);

test('Forty companion packs have level-appropriate lengths, complete checks and unambiguous closed answer structures',()=>{
 assert.equal(packs.length,40);assert.equal(new Set(packs.map(p=>p.episode)).size,40);const kinds=new Set(),band={A1:[65,90],A2:[100,140],B1:[190,215],B2:[210,240],C1:[230,256]};
 for(const e of episodes){const p=getPack(e.id);assert(p,e.id);assert(levels.includes(p.level));const n=p.reading.text.trim().split(/\s+/).length;assert(n>=band[p.level][0]&&n<=band[p.level][1],`${e.id}: ${n} words`);assert.equal(p.exercises.length,['A1','A2'].includes(p.level)?6:9);assert.equal(new Set(p.exercises.map(q=>q.id)).size,p.exercises.length);assert.equal(p.exercises.filter(q=>q.skill==='reading').length,3);assert(p.grammar.examples.length>=2);assert.equal(p.writing.checklist.length,4);assert(p.writing.min<p.writing.max);assert(p.writing.prompt);
  for(const q of p.exercises){kinds.add(q.kind);assert(q.answer&&q.explanation&&q.prompt);assert(isCorrect(q,q.answer));if(q.options){assert.equal(q.options.length,3);assert.equal(new Set(q.options).size,3);assert(q.options.includes(q.answer));assert.equal(q.options.filter(a=>isCorrect(q,a)).length,1);}if(q.kind==='order')assert.deepEqual([...q.words].sort(),q.answer.split(/\s+/).sort());}
 }
 assert.deepEqual([...kinds].sort(),['choice','gap','order','reading','transform']);
});
test('Placement has four questions per level and controls have twelve unique questions with reading sources and audio',()=>{
 for(const lang of ['en','it']){const placement=testQuestions(lang,'placement','A1');assert.equal(placement.length,20);for(const l of levels){assert.equal(placement.filter(q=>q.level===l).length,4);const control=testQuestions(lang,'control',l);assert.equal(control.length,12);assert.equal(new Set(control.map(q=>q.key)).size,12);assert(control.every(q=>q.level===l));for(const q of control){if(q.skill==='reading')assert(q.source);if(q.skill==='listening')assert(q.audio?.text);}}const answers=Object.fromEntries(placement.filter(q=>['A1','A2'].includes(q.level)).map(q=>[q.key,{correct:true}]));assert.equal(recommendedLevel(answers,placement),'A2');}
});
test('Mastery needs 80 percent, completed story, bounded writing and explicit self-review',()=>{
 const e=episodes[0],pack=getPack(e.id),p=fresh(e.id);p.phase='done';p.finishedAt='2026-10-19T12:00:00.000Z';p.results=Object.fromEntries(e.transfer.map(q=>[q.id,resultFor(q.answer,q.answer,{plays:1,text:false,translation:false})]));
 pack.exercises.slice(0,4).forEach(q=>p.practice.answers[q.id]={value:q.answer,correct:true,checkedAt:p.finishedAt});p.practice.draft=Array(pack.writing.min).fill('word').join(' ');p.practice.checks=pack.writing.checklist.map(()=>true);assert.equal(lessonScore(e,p).mastered,false);
 const q=pack.exercises[4];p.practice.answers[q.id]={value:q.answer,correct:true,checkedAt:p.finishedAt};assert.equal(lessonScore(e,p).mastered,true);p.practice.checks[0]=false;assert.equal(lessonScore(e,p).mastered,false);p.practice.checks[0]=true;p.practice.draft='short';assert.equal(lessonScore(e,p).mastered,false);
 assert.equal(isCorrect({answer:'è'},'e'),false);assert.equal(wordCount("L’amica ha ventitré anni."),4);
});
test('Old saves gain empty practice, writing and profile round-trip through backup, malformed data rejected',()=>{
 const old={...fresh()};delete old.practice;assert.deepEqual(validateProgress(old).practice,fresh().practice);const p=fresh();p.practice.draft='Il mio testo ancora da rivedere.';const data={kind:'slyshat-collection',version:2,active:p.episode,progress:{[p.episode]:p},studyProfile:freshProfile()};assert.deepEqual(validateCollection(JSON.parse(JSON.stringify(data))),data);
 assert.throws(()=>validateProgress({...p,practice:{...p.practice,draft:'a'.repeat(12001)}}));assert.throws(()=>validateProfile({...freshProfile(),dailyGoal:999}));
});
test('Reading instead of audio is classified as reading; SRS follows 1,3,7,14,30 days and difficult cards return sooner',()=>{
 const e=episodes[0],p=fresh(e.id),q=e.transfer[0];p.results[q.id]=resultFor(q.answer,q.answer,{plays:0,text:true,translation:false});const stats=skillStats({[e.id]:p});assert.equal(stats.reading.total,1);assert.equal(stats.listening.total,0);
 let r;const now=new Date('2026-01-02T12:00:00.000Z');for(const days of [1,3,7,14,30]){r=nextReview(r,true,now);assert.equal((Date.parse(r.due)-now.getTime())/86400000,days);}r=nextReview(r,false,now);assert.equal((Date.parse(r.due)-now.getTime())/60000,10);assert.equal(nextReview(r,true,now).step,0);
 const pr=freshProfile();pr.events=[{id:'1',at:'2026-01-01T12:00:00.000Z',points:2},{id:'2',at:'2026-01-02T12:00:00.000Z',points:1}];const a=activityStats(pr,now);assert.equal(a.streak,2);assert.equal(a.today,1);assert.equal(a.points,3);
});
test('Profile store isolates users and two clients preserve conflicting changes explicitly',async()=>{
 const t=transport('profile-a'),a=profile(t),b=profile(t);await a.start();await b.start();a.update(p=>({...p,goal:'work'}));await a.flush();b.update(p=>({...p,goal:'travel'}));await b.flush();assert.equal(b.status,'conflict');assert.equal((await store.get('profile-a')).data.goal,'work');b.resolve(true);await b.flush();await a.refresh();assert.equal(a.row.data.goal,'travel');assert.equal((await store.get('profile-b')).revision,0);
});
test('Profile pending changes survive offline reload and lost responses are idempotent',async()=>{
 const t=transport('profile-offline'),storage=memory(),a=profile(t,storage);await a.start();t.state.online=false;a.update(p=>({...p,dailyGoal:15}));await a.flush();assert.equal(a.status,'offline');t.state.online=true;const b=profile(t,storage);await b.start();await b.flush();assert.equal((await store.get(t.state.id)).data.dailyGoal,15);b.update(p=>({...p,goal:'culture'}));t.state.drop=true;await b.flush();const revision=(await store.get(t.state.id)).revision;await b.refresh();await b.flush();assert.equal(b.status,'synced');assert.equal((await store.get(t.state.id)).revision,revision);
});
test('A profile cannot be saved into an account that changed after load',async()=>{const t=transport('profile-old'),a=profile(t);await a.start();a.update(p=>({...p,goal:'work'}));t.state.id='profile-new';await a.flush();assert.equal(a.status,'signin');assert.equal((await store.get('profile-new')).revision,0);});
after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
