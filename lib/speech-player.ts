import {defaultVoice,speechMode,type SpeechConfig} from './speech-config';

export type PlaybackOptions={source?:string;startAt?:number;endAt?:number;text:string;locale:string;voice?:string;secondary?:boolean;speed?:number;config:SpeechConfig;onStart?:()=>void;onEnd?:()=>void;onCancel?:()=>void;onError?:(message:string)=>void;onProgress?:(position:number,duration:number)=>void};
export type Playback={stop:()=>void;setSpeed:(speed:number)=>boolean;done:Promise<boolean>};
const clips=new Map<string,string>();
let active:Playback|undefined;
export const stopSpeech=()=>active?.stop();

// One audio owner across stories, dictionaries, tests and the dialogue player.
// Cancellation is distinct from completion and never earns listening credit.
export function playSpeech(options:PlaybackOptions):Playback{
  stopSpeech();
  const {text,locale,secondary=false,voice='',config}=options;
  let speed=options.speed??1;
  let ended=false,audio:HTMLAudioElement|undefined,utterance:SpeechSynthesisUtterance|undefined,timer:ReturnType<typeof setTimeout>|undefined,boundary:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();
  let resolveDone:(completed:boolean)=>void=()=>{};
  const done=new Promise<boolean>(resolve=>{resolveDone=resolve;});
  const finish=(reason:'end'|'cancel'|'error',message='')=>{
    if(ended)return;ended=true;clearTimeout(timer);clearTimeout(boundary);controller.abort();
    if(audio){audio.onplaying=null;audio.onended=null;audio.onerror=null;audio.onloadedmetadata=null;audio.ontimeupdate=null;audio.pause();audio.removeAttribute('src');audio.load();}
    if(utterance){utterance.onstart=null;utterance.onend=null;utterance.onerror=null;window.speechSynthesis.cancel();}
    if(active===handle)active=undefined;
    resolveDone(reason==='end');
    if(reason==='end')options.onEnd?.();else if(reason==='cancel')options.onCancel?.();else options.onError?.(message);
  };
  const handle:Playback={stop:()=>finish('cancel'),setSpeed:next=>{
    if(ended||!audio||!Number.isFinite(next)||next<0.5||next>2)return false;
    speed=next;audio.playbackRate=next;watchBoundary();return true;
  },done};active=handle;
  const failed=(message:string)=>finish('error',message);
  const started=()=>{if(!ended){clearTimeout(timer);options.onStart?.();}};
  const completed=()=>finish('end');
  if(!options.source&&speechMode(voice,config)==='device'){
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){failed('Системная озвучка недоступна. Выбери нейроголос в настройках или открой текст.');return handle;}
    const uri=voice.startsWith('device:')?voice.slice(7):voice;
    const voices=window.speechSynthesis.getVoices().filter(v=>v.lang.slice(0,2).toLowerCase()===locale.slice(0,2).toLowerCase());
    const preferred=voices.filter(v=>v.lang.toLowerCase()===locale.toLowerCase());
    const pool=preferred.length?preferred:voices;
    const selected=voices.find(v=>v.voiceURI===uri)||pool[secondary&&pool.length>1?1:0];
    utterance=new SpeechSynthesisUtterance(text);utterance.lang=selected?.lang||locale;if(selected)utterance.voice=selected;utterance.rate=speed;
    utterance.onstart=started;utterance.onend=completed;utterance.onerror=()=>failed('Системный голос не запустился. Выбери другой голос в настройках.');
    timer=setTimeout(()=>failed('Системный голос не запустился. Проверь настройки звука.'),10000);
    try{window.speechSynthesis.speak(utterance);}catch{failed('Не удалось включить системный голос.');}
    return handle;
  }
  const selected=voice.startsWith('cloud:')?voice.slice(6):defaultVoice(secondary);
  const key=JSON.stringify([text,locale,selected]);
  audio=new Audio();audio.preload='auto';audio.playbackRate=speed;audio.preservesPitch=true;
  const endAt=options.endAt;
  const startAt=options.startAt??0;
  if(!Number.isFinite(startAt)||startAt<0||(endAt!==undefined&&(!Number.isFinite(endAt)||endAt<=startAt))){failed('Некорректные границы аудиофрагмента.');return handle;}
  const watchBoundary=()=>{
    clearTimeout(boundary);
    if(ended||endAt===undefined)return;
    if(Number.isFinite(audio!.currentTime))options.onProgress?.(Math.max(0,Math.min(endAt-startAt,audio!.currentTime-startAt)),endAt-startAt);
    const remaining=endAt-audio!.currentTime;
    if(remaining<=0){completed();return;}
    boundary=setTimeout(watchBoundary,Math.max(20,Math.min(100,remaining/speed*1000)));
  };
  audio.onplaying=()=>{started();watchBoundary();};
  audio.onended=()=>{if(endAt!==undefined&&audio!.currentTime<endAt-0.15)failed('Запись оборвалась до конца фрагмента.');else completed();};
  audio.onerror=()=>failed('Не удалось воспроизвести запись. Повтори или проверь звук.');
  audio.ontimeupdate=()=>{if(ended||!Number.isFinite(audio!.currentTime))return;if(endAt!==undefined){options.onProgress?.(Math.max(0,Math.min(endAt-startAt,audio!.currentTime-startAt)),endAt-startAt);if(audio!.currentTime>=endAt)completed();}};
  audio.onloadedmetadata=()=>{
    if(ended)return;
    if(endAt!==undefined&&audio!.duration<endAt-0.15){failed('Аудиофрагмент выходит за пределы записи.');return;}
    if(startAt)audio!.currentTime=startAt;
  };
  const start=(url:string)=>{
    if(ended)return;
    audio!.src=url;audio!.playbackRate=speed;
    timer=setTimeout(()=>failed('Запись не запустилась. Нажми «Слушать» ещё раз.'),15000);
    try{void audio!.play().catch(()=>{if(!ended)failed('Запись готова. Нажми «Слушать» ещё раз, чтобы разрешить воспроизведение.');});}catch{failed('Не удалось воспроизвести запись.');}
  };
  // Bundled recordings play directly and never call a synthesis API.
  if(options.source){start(options.source);return handle;}
  const cached=clips.get(key);
  // A cache hit starts inside the click handler, including Safari's second tap
  // if its autoplay policy rejected the initial asynchronous generation.
  if(cached){clips.delete(key);clips.set(key,cached);start(cached);return handle;}
  timer=setTimeout(()=>failed('Подготовка аудио заняла слишком много времени. Попробуй позже.'),55000);
  void(async()=>{
    try{
      const response=await fetch('/api/audio',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,locale,voice:selected}),signal:controller.signal});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data.message==='string'?data.message:'Не удалось подготовить аудио. Повтори позже.');}
      if(!response.headers.get('content-type')?.startsWith('audio/mpeg'))throw new Error('Сервер не вернул аудиозапись.');
      const blob=await response.blob();if(ended)return;
      clearTimeout(timer);
      const url=URL.createObjectURL(blob);clips.set(key,url);
      while(clips.size>24){const oldest=clips.keys().next().value!;URL.revokeObjectURL(clips.get(oldest)!);clips.delete(oldest);}
      start(url);
    }catch(error){if(!ended)failed(error instanceof Error?error.message:'Озвучка недоступна. Проверь соединение.');}
  })();
  return handle;
}
