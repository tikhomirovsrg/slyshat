const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative));
const courseBytes=read('content/story-course/course-v1.json'),comicBytes=read('content/comics/comic-v1.json');
const course=JSON.parse(courseBytes),comic=JSON.parse(comicBytes),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const courseHash=sha(courseBytes);
const {storyPresentation}=require('../lib/story-presentation.ts'),{buildComicBoard}=require('../lib/comic-migration.mjs');
const board=story=>buildComicBoard(story,comic,()=> 'Existing translation');

test('Both presentation releases cover every story without changing IDs, routes or audio sources',()=>{
 const before=JSON.stringify(course);
 for(const language of ['en','it']){
  const release=JSON.parse(read(`content/story-presentation/${language}-v1.json`));
  assert.equal(release.courseSha256,courseHash);assert.equal(release.comicSha256,sha(comicBytes));
  assert.deepEqual(Object.keys(release.legacy).sort(),course.stories.filter(s=>s.language===language&&s.legacy).map(s=>s.id).sort());
  assert.deepEqual(Object.keys(release.topics).sort(),Object.keys(comic.topics).sort());
  assert.deepEqual(Object.keys(release.problems).sort(),Object.keys(comic.problems).sort());
  for(const story of course.stories.filter(s=>s.language===language)){
   const text=storyPresentation(story,board(story),courseHash);
   for(const field of ['title','topic','summary','context','hook','series']){assert.equal(typeof text[field],'string');assert(text[field].trim(),story.id+'/'+field);assert(!/\p{Script=Cyrillic}/u.test(text[field]),story.id+'/'+field);}
  }
 }
 assert.equal(JSON.stringify(course),before);
});

test('Legacy and variant descriptions retain the story language, and missing/version-mismatched presentations fail explicitly',()=>{
 const en=course.stories.find(s=>s.id==='coffee-01'),it=course.stories.find(s=>s.id==='coffee-it'),variant=course.stories.find(s=>s.id==='story-en-a1-dinner-time');
 assert.equal(storyPresentation(en,board(en),courseHash).title,'Time for a coffee?');
 const italian=storyPresentation(it,board(it),courseHash);assert.equal(italian.title,'Un caffè insieme?');assert(italian.hook.includes('Mezz’ora'));
 assert.equal(storyPresentation(variant,board(variant),courseHash).title,'Dinner with the neighbours · A change of time');
 assert.throws(()=>storyPresentation(en,board(en),'wrong-hash'),/version mismatch/);
 assert.throws(()=>storyPresentation({...en,id:'unknown'},board(en),courseHash),/Missing translated story/);
});
