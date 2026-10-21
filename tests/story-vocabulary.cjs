const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const read=file=>fs.readFileSync(path.join(__dirname,'..',file));
const courseBytes=read('content/story-course/course-v1.json'),libraryBytes=read('content/audio-library/series-v1.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),courseHash=sha(courseBytes);
const course=JSON.parse(courseBytes),library=JSON.parse(libraryBytes),release=JSON.parse(read('content/story-vocabulary/v1.json'));
const {storyVocabulary}=require('../lib/story-vocabulary.ts');
const normalise=value=>value.toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const contains=(text,term)=>new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped(normalise(term))+'(?=$|[^\\p{L}\\p{N}])','u').test(normalise(text));
function spoken(story){
 return Object.values(story.nodes).flatMap(node=>[
  ...node.clips.map(clip=>(clip.set==='course'?course:library).segments[clip.id].text),
  ...node.choices.map(choice=>choice.text),
 ]);
}

test('All 2000 stories have exactly three short translated cues that occur in actual speech or answers',()=>{
 assert.equal(release.courseSha256,courseHash);assert.equal(release.librarySha256,sha(libraryBytes));
 assert.equal(course.stories.length,2000);
 assert.deepEqual(Object.keys(release.legacy).sort(),course.stories.filter(story=>story.legacy).map(story=>story.id).sort());
 const before=JSON.stringify(course),counts={en:0,it:0};
 for(const story of course.stories){
  const entries=storyVocabulary(story,courseHash),texts=spoken(story);
  assert.equal(entries.length,3,story.id);assert.equal(new Set(entries.map(entry=>normalise(entry.term))).size,3,story.id);
  for(const entry of entries){
   assert(entry.term.trim()&&entry.ru.trim(),story.id);assert(entry.term.length<=45,story.id+'/'+entry.term);
   assert(!/\p{Script=Cyrillic}|\d/u.test(entry.term),story.id+'/'+entry.term);
   assert(/\p{Script=Cyrillic}/u.test(entry.ru),story.id+'/'+entry.term);
   assert(texts.some(text=>contains(text,entry.term)),story.id+'/'+entry.term+' must be heard in this story');
  }
  counts[story.language]++;
 }
 assert.deepEqual(counts,{en:1000,it:1000});assert.equal(JSON.stringify(course),before);
 assert(!contains('affordable','afford'),'Do not accept a partial word as a spoken vocabulary match');
});

test('Legacy and variant cues retain useful expressions and become more specific with level',()=>{
 const terms=id=>storyVocabulary(course.stories.find(story=>story.id===id),courseHash).map(entry=>entry.term);
 assert.deepEqual(terms('coffee-01'),['to go','short on time','next to']);
 assert.deepEqual(terms('coffee-it'),['andare via','da asporto','di fronte']);
 assert.deepEqual(terms('story-en-a1-dinner-time'),['neighbourhood dinner','need to leave','tell everyone']);
 assert.deepEqual(terms('story-en-c1-dinner-time'),['neighbourhood dinner','informed consent','constrained']);
 assert.deepEqual(terms('story-it-b1-garden-tasks'),['orto condiviso','responsabilità','scadenza']);
 assert.deepEqual(terms('story-it-c1-museum-date'),['mostra temporanea','salvaguardare','nella misura in cui']);
});

test('Vocabulary is detached from its release and invalid story identities or source versions fail explicitly',()=>{
 const story=course.stories.find(story=>story.id==='coffee-01'),original=storyVocabulary(story,courseHash);
 const changed=storyVocabulary(story,courseHash);changed[0].term='changed';changed.pop();assert.deepEqual(storyVocabulary(story,courseHash),original);
 assert.throws(()=>storyVocabulary(story,'wrong-hash'),/version mismatch/);
 assert.throws(()=>storyVocabulary({...story,id:'unknown'},courseHash),/Missing story vocabulary/);
 assert.throws(()=>storyVocabulary({...story,language:'it'},courseHash),/Missing story vocabulary/);
 const variant=course.stories.find(story=>story.id==='story-en-a1-dinner-time');
 assert.throws(()=>storyVocabulary({...variant,language:'it'},courseHash),/identity mismatch/);
 assert.throws(()=>storyVocabulary({...variant,id:'story-en-a1-unknown-time'},courseHash),/Missing story vocabulary/);
});
