const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync,execFileSync}=require('node:child_process');
const {decodeExpansionFile}=require('../scripts/story-expansion/decode-audio.mjs');

test('Decoded audio must reach its declared cue timeline, including silently truncated streams',{skip:spawnSync('ffmpeg',['-version']).status!==0},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'expansion-decode-'));
 try{
  const complete=path.join(directory,'complete.mp3');
  execFileSync('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=24000','-t','2','-codec:a','libmp3lame','-b:a','64k',complete]);
  assert(Math.abs(decodeExpansionFile(complete,2)-2)<.02);
  assert.throws(()=>decodeExpansionFile(complete,3),/duration mismatch/);
  const truncated=path.join(directory,'truncated.mp3'),bytes=fs.readFileSync(complete);
  fs.writeFileSync(truncated,bytes.subarray(0,Math.floor(bytes.length/2)));
  assert.throws(()=>decodeExpansionFile(truncated,2),/Expansion decode (failed|duration mismatch)/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
