import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {expansionClipId,expansionChoiceId} from './story-expansion.mjs';

export const EXPANSION_LEVEL_SPEED={en:{A1:.78,A2:.86,B1:.94,B2:1,C1:1},it:{A1:.85,A2:.90,B1:.97,B2:1,C1:1}};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateExpansionAudio(manifest,release,cast,castHash,{directory,hashFiles=false}={}){
 if(manifest?.formatVersion!==1||manifest.releaseId!=='story-expansion-audio-v1'||manifest.sourceSha256!==release.checksum||manifest.castSha256!==castHash||manifest.readyStories!==release.stories.length||manifest.readyStories!==246||manifest.sampleRate!==24000||manifest.codec!=='mp3'||manifest.bitrate!==64000)throw Error('Expansion audio release mismatch');
 if(manifest.modelSha256!=='beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'||manifest.voicesSha256!=='bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d')throw Error('Expansion speech model mismatch');
 if(JSON.stringify(manifest.levelSpeed)!==JSON.stringify(EXPANSION_LEVEL_SPEED))throw Error('Expansion audio pace policy mismatch');
 if(!manifest.files||!manifest.segments||!Object.keys(manifest.files).length)throw Error('Empty expansion audio');
 const expected=new Set(),used=new Set();
 function check(id,text,actorId,story){
  expected.add(id);const clip=manifest.segments[id],profile=cast.voiceProfiles[actorId+'-'+story.language],file=clip&&manifest.files[clip.file];
  if(!clip||!file||clip.storyId!==story.id||clip.textSha256!==sha(text)||clip.actorId!==actorId||clip.voice!==profile.voice||clip.voiceProfileId!==profile.id||clip.language!==story.language||clip.speed!==Number((profile.speed*EXPANSION_LEVEL_SPEED[story.language][story.level]).toFixed(4)))throw Error('Expansion recording does not match speaker/text: '+id);
  if(!Number.isFinite(clip.start)||!Number.isFinite(clip.end)||clip.start<0||clip.end<=clip.start||clip.end>file.duration+.02)throw Error('Invalid expansion recording bounds: '+id);
  used.add(clip.file);
 }
 for(const story of release.stories)for(const [nodeId,node] of Object.entries(story.nodes)){
  node.lines.forEach((line,index)=>check(expansionClipId(story.id,nodeId,index),line.text,story.cast[line.speaker].actorId,story));
  node.choices.forEach((choice,index)=>check(expansionChoiceId(story.id,nodeId,index),choice.text,story.cast[0].actorId,story));
 }
 if(Object.keys(manifest.segments).length!==expected.size||Object.keys(manifest.segments).some(id=>!expected.has(id)))throw Error('Unexpected expansion recording');
 for(const [name,file] of Object.entries(manifest.files)){
  if(!/^[a-z0-9-]+\.mp3$/.test(name)||!used.has(name)||!Number.isFinite(file.duration)||file.duration<=0||!Number.isInteger(file.bytes)||file.bytes<=0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid expansion media file');
  if(directory){const path=resolve(directory,name);if(statSync(path).size!==file.bytes)throw Error('Incomplete expansion media: '+name);if(hashFiles&&sha(readFileSync(path))!==file.sha256)throw Error('Corrupt expansion media: '+name);}
 }
 return {readyStories:manifest.readyStories,clips:expected.size,files:used.size};
}
