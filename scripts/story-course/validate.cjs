const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),sourceBytes=fs.readFileSync(path.join(root,'content/story-course/course-v1.json')),source=JSON.parse(sourceBytes);
const media=Object.fromEntries(['course','library'].map(set=>[set,JSON.parse(fs.readFileSync(path.join(root,'public/audio/'+set+'/manifest.json')))]));
assert.equal(media.course.sourceSha256,crypto.createHash('sha256').update(sourceBytes).digest('hex'));assert.equal(media.course.readyStories,2000);
for(const [name,info] of Object.entries(media.course.files)){const file=fs.readFileSync(path.join(root,'public/audio/course',name));assert.equal(file.length,info.bytes);assert.equal(crypto.createHash('sha256').update(file).digest('hex'),info.sha256);}
const old=JSON.parse(fs.readFileSync(path.join(root,'content/audio-library/series-v1.json'))),ids=new Set();let paths=0;
for(const lang of ['en','it']){const stories=source.stories.filter(s=>s.language===lang);assert.equal(stories.length,1000);assert.deepEqual(stories.map(s=>s.position),Array.from({length:1000},(_,i)=>i+1));for(const level of source.levels)assert.equal(stories.filter(s=>s.level===level).length,200);}
for(const s of source.stories){assert(!ids.has(s.id));ids.add(s.id);const finals=[];
 function visit(id,route){assert(!route.includes(id));const node=s.nodes[id];assert(node);for(const ref of node.clips){const clip=media[ref.set].segments[ref.id],text=(ref.set==='course'?source:old).segments[ref.id];assert(clip&&text);assert.equal(clip.textSha256,text.textSha256);assert.equal(clip.voice,text.voice);assert(clip.start>=0&&clip.end>clip.start&&clip.end<=media[ref.set].files[clip.file].duration);}
  if(!node.choices.length){assert(node.outcome?.title&&node.outcome.body);finals.push(node.outcome.body);paths++;}else{assert(node.choices.length>=(s.legacy?1:2));for(const c of node.choices){assert(c.label&&c.text);visit(c.next,[...route,id]);}}
 }
 visit(s.start,[]);assert(finals.length>=2);if(!s.legacy)assert.equal(new Set(finals).size,4);
}
console.log('PASS: 2000 ordered branching comics, 200 per language/level, '+paths+' complete routes, matching audio hashes and cue bounds.');
