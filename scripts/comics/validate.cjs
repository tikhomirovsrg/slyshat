const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {buildComicBoard}=require('../../lib/comic-migration.mjs');
const courseBytes=fs.readFileSync('content/story-course/course-v1.json'),course=JSON.parse(courseBytes),library=JSON.parse(fs.readFileSync('content/audio-library/series-v1.json'));
const release=JSON.parse(fs.readFileSync('content/comics/comic-v1.json')),manifest=JSON.parse(fs.readFileSync('public/comics/v1/manifest.json'));
assert.equal(createHash('sha256').update(courseBytes).digest('hex'),release.courseSha256);
let scenes=0;const locations=new Set(manifest.assets.filter(a=>!['male','female'].includes(a.id)).map(a=>a.id));
assert.equal(locations.size,8);assert.equal(manifest.assets.length,10);
for(const a of manifest.assets)for(const f of a.files){const bytes=fs.readFileSync('public/comics/v1/'+f.file);assert.equal(bytes.length,f.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);}
for(const s of course.stories){const translate=ref=>(ref.set==='course'?course:library).segments[ref.id].ru;const b=buildComicBoard(s,release,translate);assert(b.hook&&b.series);assert(locations.has(b.cover));assert.deepEqual(Object.keys(b.scenes),Object.keys(s.nodes));
 for(const [id,panel] of Object.entries(b.scenes)){assert(locations.has(panel.location));assert(['wide','left','right','detail'].includes(panel.shot));assert(['neutral','speaking','thinking','pleased'].includes(panel.mood));assert(['phone','clock','map','cup','book','ticket','camera','parcel','tools','umbrella','laptop','conversation'].includes(panel.prop));assert(panel.caption);assert.equal(panel.clue.body,s.nodes[id].clips.map(translate).join('\n\n'));scenes++;}
}
console.log(`Comics verified: ${course.stories.length} storyboards, ${scenes} scenes, 8 locations, fox and raven with 4 poses each.`);
