import {spawnSync} from 'node:child_process';

export function decodeExpansionFile(path,expectedDuration){
 if(!Number.isFinite(expectedDuration)||expectedDuration<=0)throw Error('Invalid expansion decode duration');
 // Count decoded samples rather than MP3 header duration or progress timestamps.
 // A truncated stream may decode successfully while ending before its last cue.
 const maxBuffer=Math.min(128*1024*1024,Math.ceil((expectedDuration+.25)*24000*4));
 const decoded=spawnSync('ffmpeg',['-nostdin','-v','error','-i',path,'-f','f32le','-ac','1','-ar','24000','pipe:1'],{maxBuffer,timeout:30000});
 const stderr=decoded.stderr?.toString().trim();
 if(decoded.status!==0||stderr)throw Error('Expansion decode failed '+path+': '+(stderr||decoded.error||decoded.signal));
 const seconds=decoded.stdout.length/(24000*4);
 if(decoded.stdout.length%4||!Number.isFinite(seconds)||Math.abs(seconds-expectedDuration)>.02)throw Error('Expansion decode duration mismatch '+path+': '+seconds+'s, expected '+expectedDuration+'s');
 return seconds;
}
