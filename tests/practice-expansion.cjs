const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {episodes,getEpisode}=require('../app/episodes.ts'),{getPack}=require('../app/packs.ts');
const {practiceSets,extraQuestions}=require('../app/extra-practice.ts');
const {isCorrect,answerSkill,levels}=require('../app/study-types.ts');
const {fresh,validateProgress,validateCollection}=require('../app/learning.ts');
const {questionBank,lessonScore,skillStats,testQuestions}=require('../app/study.ts');
const {initializeDatabase}=require('../lib/db-migrations.mjs');
const root=path.resolve(__dirname,'..'),releasePath=path.join(root,'content/practice-v2.json'),seedPath=path.join(root,'content/catalog-v1.json');
const answer=q=>({value:q.answer,correct:true,checkedAt:'2026-10-20T12:00:00.000Z',...(q.audio?{listened:true,assisted:false}:{})});

test('320 new questions have valid keys, sources and answer choices; English and Italian stay separate',()=>{
 require('../scripts/validate-practice.cjs');
 assert.equal(questionBank('it').length,456);assert.equal(questionBank('en').length,296);
 for(const lang of ['it','en']){
  const bank=questionBank(lang);assert.equal(new Set(bank.map(q=>q.key)).size,bank.length);
  for(const q of bank){assert.equal(getEpisode(q.episode).language,lang);assert(isCorrect(q,q.answer),q.id);if(q.skill==='reading')assert(q.source,q.id);if(q.skill==='listening')assert(q.audio,q.id);}
 }
 const q=extraQuestions('birthday-plan-it').find(q=>q.kind==='gap'&&q.audio);
 assert(isCorrect(q,'se lo avessi saputo ti avrei avvisato'));assert(isCorrect(q,'Se l’avessi saputo, ti avrei avvisato.'));
 assert(!isCorrect(q,'Se lo avessi saputo ti avrei avvisata'));
 assert(!isCorrect({answer:'è'},'e'));
});

test('Extra answers and audio assistance round-trip through exports without changing old mastery or writing',()=>{
 for(const e of episodes){
  const p=fresh(e.id),pack=getPack(e.id);p.finishedAt='2026-10-20T11:00:00.000Z';p.phase='done';p.practice.draft=Array(pack.writing.min).fill('parola').join(' ');p.practice.checks=pack.writing.checklist.map(()=>true);
  for(const q of pack.exercises)p.practice.answers[q.id]=answer(q);
  for(const q of e.transfer)p.results[q.id]={choice:q.answer,correct:true,withoutText:true,firstListen:true,listened:true};
  const before=lessonScore(e,p);assert(before.mastered);
  for(const q of extraQuestions(e.id)){p.practice.answers[q.id]={...answer(q),correct:false,value:'wrong'};p.practice.mistakes.push(q.id);p.practice.errorReviews[q.id]=answer(q);}
  assert.deepEqual(lessonScore(e,p),before);
  const backup={kind:'slyshat-collection',version:2,active:e.id,progress:{[e.id]:p}};
  assert.deepEqual(validateCollection(JSON.parse(JSON.stringify(backup))),backup);
 }
 const p=fresh('coffee-it'),q=extraQuestions('coffee-it')[0];p.practice.answers[q.id]={...answer(q),listened:'yes'};
 assert.throws(()=>validateProgress(p),/Неизвестное задание/);
 delete p.practice.answers[q.id];p.practice.answers['another-story-id']=answer(q);assert.throws(()=>validateProgress(p));
});

test('Opening a transcript always classifies new audio answers as reading, including after reload',()=>{
 const p=fresh('coffee-it'),[a,b,c]=extraQuestions('coffee-it');
 p.practice.answers[a.id]={...answer(a),assisted:true};
 p.practice.answers[b.id]={...answer(b),listened:false,assisted:true};
 p.practice.answers[c.id]=answer(c);
 const restored=validateProgress(JSON.parse(JSON.stringify(p)));
 const stats=skillStats({'coffee-it':restored});assert.deepEqual(stats.reading,{correct:2,total:2});assert.deepEqual(stats.listening,{correct:1,total:1});
 assert.equal(answerSkill(a,{...answer(a),listened:true,assisted:true}),'reading');
 assert.equal(answerSkill(a,{value:a.answer,correct:true,checkedAt:'2026-10-20T12:00:00Z'}),'reading');
});

test('Rotating controls have 12 unique questions with context; saved test IDs and placement stay valid',()=>{
 for(const lang of ['it','en'])for(const level of levels){
  const bank=questionBank(lang),first=testQuestions(lang,'control',level,0),second=testQuestions(lang,'control',level,1);
  assert.notDeepEqual(first.map(q=>q.key),second.map(q=>q.key));
  const seen=new Set();
  for(let attempt=0;attempt<25;attempt++){
   const qs=testQuestions(lang,'control',level,attempt);assert.equal(qs.length,12);assert.equal(new Set(qs.map(q=>q.key)).size,12);
   for(const q of qs){assert.equal(q.level,level);assert(bank.some(x=>x.key===q.key));seen.add(q.key);if(q.skill==='reading')assert(q.source);}
  }
  assert([...seen].some(id=>id.includes('-extra-')));
  assert.equal(testQuestions(lang,'placement',level,0).length,20);
  assert.deepEqual(testQuestions(lang,'placement',level,0),testQuestions(lang,'placement',level,5));
 }
});

test('v3 upgrade adds 80 sets exactly once and preserves users, sessions, progress and edited materials',()=>{
 const db=new DatabaseSync(':memory:');try{
  initializeDatabase(db);
  db.exec('DROP TABLE content_practice_sets; DROP TABLE content_practice_releases; PRAGMA user_version=3;');
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u','123','Learner','2026-10-19');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('hash','u',9999999999999);
  db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run('u','coffee-it',JSON.stringify(fresh('coffee-it')),7,'mutation-old','2026-10-19');
  db.prepare('UPDATE content_stories SET title=? WHERE id=?').run('Edited title','coffee-it');
  const tables=['users','sessions','progress','runs','study_profiles','content_stories','project_documents','content_seed_versions'];
  const before=tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());
  assert.equal(initializeDatabase(db).practiceSeeded,true);
  assert.deepEqual(tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all()),before);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);
  assert.equal(db.prepare('SELECT count(*) n FROM content_practice_sets').get().n,80);
  for(const s of practiceSets)assert.deepEqual(JSON.parse(db.prepare('SELECT data_json FROM content_practice_sets WHERE id=?').get(s.id).data_json),s);
  const row=db.prepare('SELECT data_json FROM content_practice_sets LIMIT 1').get();
  const set=JSON.parse(row.data_json);set.title='Editorial revision';db.prepare('UPDATE content_practice_sets SET data_json=? WHERE id=?').run(JSON.stringify(set),set.id);
  assert.equal(initializeDatabase(db).practiceSeeded,false);
  assert.equal(JSON.parse(db.prepare('SELECT data_json FROM content_practice_sets WHERE id=?').get(set.id).data_json).title,'Editorial revision');
  assert.equal(db.prepare('SELECT question_count FROM content_practice_releases').get().question_count,320);
 }finally{db.close();}
});

test('Bad practice releases roll back the whole migration and immutable release checksums reject rewrites',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-practice-')),file=path.join(dir,'release.json'),db=new DatabaseSync(':memory:');
 try{
  const bad=JSON.parse(fs.readFileSync(releasePath));bad.sets[0].episode='unknown-story';fs.writeFileSync(file,JSON.stringify(bad));
  assert.throws(()=>initializeDatabase(db,seedPath,file),/story reference/);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table'").get().n,0);
  initializeDatabase(db);const changed=JSON.parse(fs.readFileSync(releasePath));changed.sets[0].title='Changed';fs.writeFileSync(file,JSON.stringify(changed));
  assert.throws(()=>initializeDatabase(db,seedPath,file),/releaseId/);
  assert.equal(db.prepare('SELECT count(*) n FROM content_practice_sets').get().n,80);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('Practice panel exposes optional sets and keeps transcript hidden before an audio answer',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {PracticePanel}=require('../app/practice-panel.tsx'),{QuestionCard}=require('../app/question-card.tsx');
 const html=renderToStaticMarkup(React.createElement(PracticePanel,{episode:getEpisode('coffee-it'),p:fresh('coffee-it'),onChange(){},onActivity(){},initial:'extra'}));
 assert(html.includes('Ещё практика 0/12'));assert.equal((html.match(/class="practice-set-card"/g)||[]).length,3);
 const q=extraQuestions('coffee-it')[0];const card=renderToStaticMarkup(React.createElement(QuestionCard,{q,audio:q.audio,onAnswer(){}}));
 assert(!card.includes(q.audio.text));assert(!card.includes(q.explanation));assert(card.includes('Слушать реплику'));
 const completed=renderToStaticMarkup(React.createElement(QuestionCard,{q,audio:q.audio,result:{...answer(q),assisted:true},onAnswer(){}}));assert(completed.includes('учтено как чтение'));
});
