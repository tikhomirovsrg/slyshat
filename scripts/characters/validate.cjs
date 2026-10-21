const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {characterHash,validateCharacterCast}=require('../../lib/character-cast.mjs');
const read=file=>fs.readFileSync(path.join(__dirname,'../..',file));
const courseBytes=read('content/story-course/course-v1.json'),libraryBytes=read('content/audio-library/series-v1.json');
const course=JSON.parse(courseBytes),library=JSON.parse(libraryBytes),cast=JSON.parse(read('content/characters/cast-v1.json'));
validateCharacterCast(cast,{course,courseSha256:characterHash(courseBytes),librarySha256:characterHash(libraryBytes),librarySegments:library.segments});
const manifest=JSON.parse(read('public/comics/characters/v1/manifest.json'));
assert.equal(manifest.releaseId,'character-art-v1');assert.equal(manifest.layout,'sheet-2x2');
assert.deepEqual(manifest.poses,['neutral','speaking','thinking','pleased']);
assert.equal(manifest.actors.length,6);assert.deepEqual(manifest.actors.map(a=>a.id).sort(),Object.keys(cast.actors).sort());
for(const asset of manifest.actors){
 const actor=cast.actors[asset.id];assert.equal(actor.species,'человек');assert.equal(actor.artLayout,'sheet-2x2');assert.equal(asset.file,asset.id+'-sheet.png');
 assert.equal(actor.artBase,`/comics/characters/v1/${asset.id}`);assert(asset.prompt.includes('HUMAN'));assert(asset.transparent);
 const bytes=read('public/comics/characters/v1/'+asset.file);assert.equal(bytes.length,asset.bytes);assert.equal(characterHash(bytes),asset.sha256);
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.toString('ascii',12,16),'IHDR');
 assert.equal(bytes.readUInt32BE(16),asset.width);assert.equal(bytes.readUInt32BE(20),asset.height);assert.equal(bytes[25],6,'PNG must include RGBA alpha');
 assert.equal(asset.width%2,0);assert.equal(asset.height%2,0);assert(Math.abs(asset.width/asset.height-0.8)<0.01);
}
console.log(`Characters verified: ${course.stories.length} casts, 6 human actors × 4 poses, ${Object.keys(cast.voiceProfiles).length} voice profiles.`);
