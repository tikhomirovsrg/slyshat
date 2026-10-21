const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {SpeechService,serverSpeechConfig}=require('../lib/speech-server.ts');
const {speechCatalog}=require('../lib/speech-catalog.ts');
const {episodes}=require('../app/episodes.ts'),{questionBank}=require('../app/study.ts');
const {fresh,validateProgress}=require('../app/learning.ts');
const {speechMode}=require('../lib/speech-config.ts');
const mp3=Buffer.from([0x49,0x44,0x33,4,0,0,0,0,0,0,0xff,0xfb]); // Protocol fixture, not a voice sample.
const response=()=>Response.json({audioContent:mp3.toString('base64')});
const input={text:'Ciao!',locale:'it-IT',voice:'aoede'};
const catalog=new Map([['it-IT',new Set(['Ciao!','Come stai?','Tre.','Quattro.'])]]);
function fixture(options={}){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'slyshat-audio-'));const service=new SpeechService({directory,apiKey:'fixture-not-a-secret',dailyCharacters:100,catalog,...options});return {directory,service,cleanup(){service.close();fs.rmSync(directory,{recursive:true,force:true});}};}

test('All spoken story, fragment, phrase and question texts are allowlisted with their locale',()=>{
 for(const e of episodes){
  const set=speechCatalog.get(e.locale);assert(set);
  for(const text of [e.checkText,e.opening,...e.phrases.flatMap(p=>[p.text,p.part,p.example]),...e.transfer.map(t=>t.text),...Object.values(e.nodes).flatMap(n=>[n.text,...n.choices.map(c=>c.text)])]){
   assert(set.has(text));assert(Buffer.byteLength(text)<=5000);
   for(const part of text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[])assert(set.has(part.trim()));
  }
 }
 for(const lang of ['en','it'])for(const q of questionBank(lang))if(q.audio)assert(speechCatalog.get(q.audio.locale)?.has(q.audio.text));
 assert(!speechCatalog.get('it-IT').has('Private writing draft'));
});

test('Identical parallel requests bill once; disk cache survives restart; voice changes produce separate audio',async()=>{
 let calls=0;let release;const gate=new Promise(r=>release=r);
 const f=fixture({fetcher:async(url,options)=>{calls++;assert.equal(url,'https://texttospeech.googleapis.com/v1/text:synthesize');assert.equal(options.headers['X-Goog-Api-Key'],'fixture-not-a-secret');const data=JSON.parse(options.body);assert.equal(data.input.text,'Ciao!');assert.equal(data.voice.languageCode,'it-IT');assert(data.voice.name.startsWith('it-IT-Chirp3-HD-'));assert.deepEqual(data.audioConfig,{audioEncoding:'MP3'});await gate;return response();}});
 let reopened;
 try{
  const a=f.service.speak(input),b=f.service.speak(input);release();assert.deepEqual(await a,mp3);assert.deepEqual(await b,mp3);assert.equal(calls,1);
  assert.deepEqual(await f.service.speak(input),mp3);assert.equal(calls,1);
  await f.service.speak({...input,voice:'charon'});assert.equal(calls,2);
  f.service.close();reopened=new SpeechService({directory:f.directory,apiKey:'',dailyCharacters:0,catalog,fetcher:()=>{throw new Error('Must not contact provider');}});
  assert.deepEqual(await reopened.speak(input),mp3);assert.deepEqual(await reopened.speak({...input,voice:'charon'}),mp3);
  await assert.rejects(reopened.speak({...input,text:'Come stai?'}),e=>e.code==='not_configured');
 }finally{reopened?.close();fs.rmSync(f.directory,{recursive:true,force:true});}
});

test('Daily spend reservations persist across restart; cache still works at limit and next UTC day resets usage',async()=>{
 let now=new Date('2026-10-21T23:59:00Z'),calls=0;
 const f=fixture({dailyCharacters:5,now:()=>now,fetcher:async()=>{calls++;return response();}});let reopened;
 try{
  await f.service.speak(input);f.service.close();
  reopened=new SpeechService({directory:f.directory,apiKey:'test',dailyCharacters:5,catalog,now:()=>now,fetcher:async()=>{calls++;return response();}});
  await assert.rejects(reopened.speak({...input,voice:'charon'}),e=>e.code==='daily_limit');assert.equal(calls,1);
  assert.deepEqual(await reopened.speak(input),mp3);
  now=new Date('2026-10-22T00:01:00Z');await reopened.speak({...input,voice:'charon'});assert.equal(calls,2);
 }finally{reopened?.close();fs.rmSync(f.directory,{recursive:true,force:true});}
});

test('Unknown text, locale and voice never reach provider; errors never enter cache or expose its response',async()=>{
 let calls=0;const f=fixture({fetcher:async()=>{calls++;return Response.json({error:'secret provider diagnostic'},{status:403});}});
 try{
  for(const bad of [{...input,text:'private draft'},{...input,locale:'en-GB'},{...input,voice:'../../file'},{...input,text:null}])await assert.rejects(f.service.speak(bad),e=>e.code==='invalid_audio');
  assert.equal(calls,0);
  await assert.rejects(f.service.speak(input),e=>e.code==='provider_configuration'&&!e.message.includes('secret'));
  assert.equal(calls,1);assert(!fs.readdirSync(f.directory).some(n=>n.endsWith('.mp3')||n.endsWith('.tmp')));
 }finally{f.cleanup();}
});

test('Malformed audio is rejected and a failed request keeps its budget reservation',async()=>{
 const f=fixture({dailyCharacters:5,fetcher:async()=>Response.json({audioContent:Buffer.from('not audio').toString('base64')})});
 try{await assert.rejects(f.service.speak(input),e=>e.code==='provider');await assert.rejects(f.service.speak(input),e=>e.code==='daily_limit');assert(!fs.readdirSync(f.directory).some(n=>n.endsWith('.mp3')));}finally{f.cleanup();}
});

test('Neural preferences survive existing progress validation; explicit device mode is never overridden',()=>{
 const p=fresh('coffee-it');p.voiceMaya='cloud:kore';p.voiceOliver='cloud:puck';assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p))),p);
 assert.equal(speechMode('old-device-voice',{provider:'google'}),'google');assert.equal(speechMode('device:old-device-voice',{provider:'google'}),'device');assert.equal(speechMode('cloud:kore',{provider:'device'}),'google');
 const old=process.env.GOOGLE_TTS_API_KEY;process.env.GOOGLE_TTS_API_KEY='secret-test';assert(!JSON.stringify(serverSpeechConfig()).includes('secret-test'));if(old===undefined)delete process.env.GOOGLE_TTS_API_KEY;else process.env.GOOGLE_TTS_API_KEY=old;
});

test('One shared player cancels an old owner; stopping while loading or playing never completes a listening answer',async()=>{
 const original={window:global.window,Audio:global.Audio,fetch:global.fetch};const audios=[];let calls=0,resolveFetch;const firstResponse=new Promise(r=>resolveFetch=r);
 class FakeAudio{constructor(){audios.push(this);}play(){this.onplaying?.();return Promise.resolve();}pause(){}load(){}removeAttribute(){}}
 global.window={};global.Audio=FakeAudio;global.fetch=()=>{calls++;return firstResponse;};
 const {playSpeech,stopSpeech}=require('../lib/speech-player.ts');let completed=0,canceled=0;
 const options={text:'Ciao!',locale:'it-IT',config:{provider:'google',ready:true},onEnd:()=>completed++,onCancel:()=>canceled++};
 try{
  const a=playSpeech(options);a.stop();resolveFetch(new Response(mp3,{headers:{'Content-Type':'audio/mpeg'}}));assert.equal(await a.done,false);await new Promise(r=>setImmediate(r));assert.equal(completed,0);assert.equal(canceled,1);assert.equal(audios[0].src,undefined);
  global.fetch=async()=>{calls++;return new Response(mp3,{headers:{'Content-Type':'audio/mpeg'}});};
  const b=playSpeech({...options,speed:0.9});await new Promise(r=>setImmediate(r));assert.equal(audios.at(-1).playbackRate,0.9);assert.equal(audios.at(-1).preservesPitch,true);
  const c=playSpeech(options);assert.equal(await b.done,false);assert.equal(canceled,2);audios.at(-1).onended();assert.equal(await c.done,true);assert.equal(completed,1);assert.equal(calls,2); // Second click reused the clip.
 }finally{stopSpeech();global.window=original.window;global.Audio=original.Audio;global.fetch=original.fetch;}
});

test('Changing recording speed keeps its position and completion boundary, including while loading',async()=>{
 const original={window:global.window,Audio:global.Audio};const audios=[];
 class FakeAudio{constructor(){this.currentTime=0;this.duration=100;this.pauses=0;audios.push(this);}play(){return Promise.resolve();}pause(){this.pauses++;}load(){}removeAttribute(){}}
 global.window={};global.Audio=FakeAudio;
 const {playSpeech,stopSpeech}=require('../lib/speech-player.ts');let completed=0,canceled=0;
 const options={source:'/audio/course/it-a1-v1.mp3',startAt:10,endAt:20,text:'Ciao',locale:'it-IT',config:{provider:'device'},onEnd:()=>completed++,onCancel:()=>canceled++};
 try{
  const a=playSpeech(options),audio=audios[0];assert(a.setSpeed(.5));audio.onloadedmetadata();audio.onplaying();assert.equal(audio.currentTime,10);assert.equal(audio.playbackRate,.5);
  audio.currentTime=14;assert(a.setSpeed(1.5));assert.equal(audio.currentTime,14);assert.equal(audio.playbackRate,1.5);assert.equal(audio.pauses,0);assert.equal(audio.preservesPitch,true);assert.equal(completed,0);assert.equal(canceled,0);
  for(const value of [NaN,Infinity,0,3])assert.equal(a.setSpeed(value),false);assert.equal(audio.playbackRate,1.5);
  audio.currentTime=20;audio.ontimeupdate();assert.equal(await a.done,true);assert.equal(completed,1);assert.equal(a.setSpeed(1),false);
  const b=playSpeech(options);b.setSpeed(.75);b.stop();assert.equal(await b.done,false);assert.equal(completed,1);assert.equal(canceled,1);
 }finally{stopSpeech();Object.assign(global,original);}
});

test('Every selectable playback speed survives saved-progress validation',()=>{
 const {playbackSpeeds}=require('../lib/playback-speed.ts');
 for(const speed of playbackSpeeds){const p={...fresh('coffee-it'),speed};assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p))),p);}
 assert.throws(()=>validateProgress({...fresh('coffee-it'),speed:0}));
});
