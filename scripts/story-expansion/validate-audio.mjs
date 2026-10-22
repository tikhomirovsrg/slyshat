import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {decodeExpansionFile} from './decode-audio.mjs';
import {readExpansion} from '../../lib/story-expansion.mjs';
import {validateExpansionAudio} from '../../lib/story-expansion-audio.mjs';

const index=process.argv.indexOf('--directory'),directory=resolve(index>=0?process.argv[index+1]:'public/audio/expansion');
if(process.argv.includes('--if-present')&&!existsSync(resolve(directory,'manifest.json'))){
 console.log('Expansion audio is not published; new stories are available as reading, without listening credit.');
 process.exit(0);
}
const release=readExpansion(),bytes=readFileSync('content/characters/cast-v1.json'),cast=JSON.parse(bytes),manifest=JSON.parse(readFileSync(resolve(directory,'manifest.json')));
const result=validateExpansionAudio(manifest,release,cast,createHash('sha256').update(bytes).digest('hex'),{directory,hashFiles:true});
if(process.argv.includes('--decode'))for(const [name,file] of Object.entries(manifest.files))decodeExpansionFile(resolve(directory,name),file.duration);
console.log(JSON.stringify({...result,sourceSha256:release.checksum,decoded:process.argv.includes('--decode')}));
