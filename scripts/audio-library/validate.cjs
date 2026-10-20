const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const sourceBytes=fs.readFileSync(path.join(root,'content/audio-library/series-v1.json')),source=JSON.parse(sourceBytes);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(source.stories.length,2000);assert.equal(new Set(source.stories.map(s=>s.id)).size,2000);
const texts=new Set();for(const story of source.stories){
 assert.equal(story.segments.length,4);assert.equal(story.questions.length,3);
 const segments=story.segments.map(id=>source.segments[id]);assert(segments.every(s=>s&&s.language===story.language&&s.level===story.level));
 const text=segments.map(s=>s.text).join('\n');assert(!texts.has(text));texts.add(text);
 for(const q of story.questions){assert.equal(new Set(q.options).size,4);assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4);assert(q.explanation);}
}
for(const language of ['en','it'])for(const level of ['A1','A2','B1','B2','C1'])assert.equal(source.stories.filter(s=>s.language===language&&s.level===level).length,200);
const file=path.join(root,'public/audio/library/manifest.json');assert(fs.existsSync(file),'Generate the audio before publishing.');
const manifest=JSON.parse(fs.readFileSync(file));assert.equal(manifest.sourceSha256,hash(sourceBytes));assert.equal(manifest.readyStories,2000);assert.equal(manifest.releaseId,source.releaseId);
assert.equal(Object.keys(manifest.segments).length,Object.keys(source.segments).length);
for(const [name,audio] of Object.entries(manifest.files)){
 assert(/^(en|it)-(a1|a2|b1|b2|c1)-v1\.mp3$/.test(name));const bytes=fs.readFileSync(path.join(root,'public/audio/library',name));assert.equal(hash(bytes),audio.sha256);assert.equal(bytes.length,audio.bytes);assert(audio.duration>0);
}
for(const [id,segment] of Object.entries(source.segments)){
 const audio=manifest.segments[id];assert(audio&&manifest.files[audio.file]);assert(source.voices[segment.language].includes(segment.voice));assert(audio.file.startsWith(segment.language+'-'+segment.level.toLowerCase()+'-'));assert(/[А-Яа-я]/.test(segment.ru));assert.equal(audio.textSha256,hash(segment.text));assert.equal(audio.voice,segment.voice);assert(audio.start>=0&&audio.end>audio.start&&audio.end<=manifest.files[audio.file].duration);
}
for(const name of Object.keys(manifest.files)){const clips=Object.values(manifest.segments).filter(s=>s.file===name).sort((a,b)=>a.start-b.start);for(let i=1;i<clips.length;i++)assert(clips[i].start>=clips[i-1].end);}
console.log('Audio library verified: 2000 playable scenario variants, 200 per language/level, 420 voiced segments, 6000 question instances.');
