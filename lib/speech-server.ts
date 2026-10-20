import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {neuralVoices,type SpeechConfig} from './speech-config';

export class SpeechError extends Error {
  constructor(public code:string,public status:number, message:string){super(message);}
}
export function serverSpeechConfig():SpeechConfig{
  const provider=process.env.TTS_PROVIDER==='google'?'google':'device';
  const ready=provider==='google'&&!!process.env.GOOGLE_TTS_API_KEY?.trim();
  return {provider,ready,message:ready?'Нейроозвучка подключена. Первое прослушивание новой реплики может занять несколько секунд.':provider==='google'?'Нейроозвучка пока не настроена на сервере. Можно явно выбрать системный голос.':'Нейроозвучка ещё не подключена. Сейчас используются голоса устройства.'};
}
type SpeechRequest={text:string;locale:string;voice:string};
type Options={directory:string;apiKey:string;dailyCharacters:number;catalog:Map<string,Set<string>>;fetcher?:typeof fetch;now?:()=>Date};
const failure=()=>new SpeechError('provider',502,'Сервис озвучки не ответил. Повтори позже или выбери системный голос в настройках.');
export class SpeechService {
  private jobs=new Map<string,Promise<Buffer>>();
  private initializing:Promise<void>|undefined;
  private usage:DatabaseSync|undefined;
  constructor(private options:Options){}
  private initialize(){
    return this.initializing??=(async()=>{
      await mkdir(this.options.directory,{recursive:true});
      this.usage=new DatabaseSync(path.join(this.options.directory,'usage.sqlite'));
      this.usage.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS daily_usage(day TEXT PRIMARY KEY,characters INTEGER NOT NULL);');
    })();
  }
  private reserve(characters:number){
    const db=this.usage!,day=(this.options.now?.()||new Date()).toISOString().slice(0,10);
    db.exec('BEGIN IMMEDIATE');
    try{
      const used=Number(db.prepare('SELECT characters FROM daily_usage WHERE day=?').get(day)?.characters||0);
      if(used+characters>this.options.dailyCharacters)throw new SpeechError('daily_limit',429,'Сегодня достигнут лимит новых аудиозаписей. Сохранённые записи доступны; новые можно послушать завтра.');
      db.prepare('INSERT INTO daily_usage VALUES (?,?) ON CONFLICT(day) DO UPDATE SET characters=characters+excluded.characters').run(day,characters);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  async speak(input:SpeechRequest):Promise<Buffer>{
    const {text,locale,voice}=input;
    const selected=neuralVoices.find(v=>v.id===voice);
    if(typeof text!=='string'||typeof locale!=='string'||!selected||Buffer.byteLength(text)>5000||!this.options.catalog.get(locale)?.has(text))throw new SpeechError('invalid_audio',400,'Эта реплика или голос отсутствуют в учебных материалах.');
    const name=`${locale}-Chirp3-HD-${selected.name}`;
    // Key includes every synthesis-affecting parameter; playback rate is local.
    const key=createHash('sha256').update(JSON.stringify({version:1,provider:'google',name,text,format:'MP3'})).digest('hex');
    await this.initialize();
    const file=path.join(this.options.directory,key+'.mp3');
    try{return await readFile(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const existing=this.jobs.get(key);if(existing)return existing;
    if(!this.options.apiKey)throw new SpeechError('not_configured',503,'Для новой записи нужно подключить нейроозвучку на сервере.');
    if(this.jobs.size>=3)throw new SpeechError('busy',429,'Готовим другие реплики. Повтори через несколько секунд.');
    // Deliberately retain the reservation on errors: a timed-out provider may
    // still bill a request. No automatic paid retries, including after restart.
    this.reserve(Array.from(text).length);
    const job=this.generate(text,locale,name,file);
    this.jobs.set(key,job);
    try{return await job;}finally{this.jobs.delete(key);}
  }
  private async generate(text:string,locale:string,name:string,file:string){
    let response:Response;
    try{
      response=await (this.options.fetcher||fetch)('https://texttospeech.googleapis.com/v1/text:synthesize',{
        method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.options.apiKey},
        body:JSON.stringify({input:{text},voice:{languageCode:locale,name},audioConfig:{audioEncoding:'MP3'}}),
        signal:AbortSignal.timeout(45000),cache:'no-store',redirect:'error',
      });
    }catch{throw failure();}
    if(!response.ok){
      await response.body?.cancel();
      if(response.status===401||response.status===403)throw new SpeechError('provider_configuration',503,'Сервис озвучки отклонил доступ. Администратору нужно проверить ключ, включение Cloud Text-to-Speech API и оплату.');
      if(response.status===429)throw new SpeechError('provider_limit',429,'Сервис озвучки достиг своего лимита. Попробуй позже; сохранённые записи доступны.');
      throw failure();
    }
    // Bound memory even if the upstream returns malformed data.
    const reader=response.body?.getReader();if(!reader)throw failure();
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw failure();}chunks.push(value);}}catch{throw failure();}
    let encoded:unknown;try{encoded=JSON.parse(Buffer.concat(chunks).toString('utf8')).audioContent;}catch{throw failure();}
    if(typeof encoded!=='string'||!encoded.length||encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw failure();
    const audio=Buffer.from(encoded,'base64');
    if(audio.length<4||!(audio.subarray(0,3).toString()==='ID3'||audio[0]===0xff&&(audio[1]&0xe0)===0xe0))throw failure();
    const temporary=file+'.'+randomUUID()+'.tmp';
    try{await writeFile(temporary,audio,{flag:'wx',mode:0o600});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
    return audio;
  }
  close(){this.usage?.close();}
}
export function dailyCharacterLimit(){
  const raw=process.env.TTS_DAILY_CHAR_LIMIT??'20000';
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw new SpeechError('configuration',503,'Проверь лимит озвучки на сервере.');
  return Number(raw);
}
