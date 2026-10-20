const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),release=JSON.parse(fs.readFileSync(path.join(root,'content/practice-v2.json'),'utf8'));
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'content/catalog-v1.json'),'utf8'));
const stories=new Map(catalogue.stories.map(s=>[s.id,s]));
const setIds=new Set(),questionIds=new Set(),counts={en:0,it:0},audioCounts={en:0,it:0};
const norm=s=>s.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/[.!?]+$/,'');
assert.equal(release.formatVersion,1);assert.equal(release.releaseId,'practice-expansion-v2');assert.equal(release.sets.length,80);
for(const set of release.sets){
 const story=stories.get(set.episode);assert(story&&story.status==='available',set.id);assert.equal(story.language,set.language);assert.equal(story.practiceLevel,set.level);
 assert(!setIds.has(set.id));setIds.add(set.id);assert(set.title&&set.description&&set.minutes>0);assert.equal(set.questions.length,4);
 for(const q of set.questions){
  assert(!questionIds.has(q.id),q.id);questionIds.add(q.id);assert(q.id.startsWith(set.id+'-q'));assert(q.prompt&&q.answer&&q.explanation,q.id);
  assert(['choice','gap','order','transform','reading'].includes(q.kind));assert(['grammar','vocabulary','reading','listening'].includes(q.skill));
  if(q.options){assert.equal(q.options.length,3);assert.equal(new Set(q.options.map(norm)).size,3);assert.equal(q.options.filter(o=>norm(o)===norm(q.answer)).length,1,q.id);}
  if(q.kind==='order')assert.deepEqual([...q.words].sort(),q.answer.split(/\s+/).sort(),q.id);
  if(q.skill==='listening'){assert(q.audio?.text&&q.audio.ru,q.id);assert.equal(q.audio.locale,set.language==='it'?'it-IT':'en-GB');assert(!/[а-яё]/i.test(q.audio.text));audioCounts[set.language]++;}
  if(q.skill==='reading')assert(q.source&&q.source.length>120,q.id);
  counts[set.language]++;
 }
}
assert.deepEqual(counts,{en:80,it:240});assert.deepEqual(audioCounts,{en:80,it:80});
for(const story of catalogue.stories.filter(s=>s.status==='available'))assert.equal(release.sets.filter(s=>s.episode===story.id).length,story.language==='it'?3:1,story.id);
console.log('Practice release verified: 80 sets, 320 questions (240 Italian, 80 English), 160 audio tasks.');
