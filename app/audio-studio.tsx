'use client';
import {useEffect,useRef,useState} from 'react';
import {episodes,type Episode} from './episodes';
import type {Progress} from './learning';
import {useSpeechPlayer,SpeechLabel} from './speech';
import {RecordedAudio} from './recorded-audio';
import {AudioLibrary} from './audio-library';
import type {Profile} from './use-profile';
export function VoiceRecorder(){
 const [recording,setRecording]=useState(false),[url,setUrl]=useState(''),[error,setError]=useState('');const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),clip=useRef('');
 useEffect(()=>()=>{recorder.current?.state==='recording'&&recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(clip.current)URL.revokeObjectURL(clip.current);},[]);
 const start=async()=>{try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError('Запись недоступна в этом браузере.');return;}const s=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=s;const r=new MediaRecorder(s);recorder.current=r;const chunks:BlobPart[]=[];r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};r.onstop=()=>{s.getTracks().forEach(t=>t.stop());if(clip.current)URL.revokeObjectURL(clip.current);clip.current=URL.createObjectURL(new Blob(chunks,{type:r.mimeType}));setUrl(clip.current);setRecording(false);};r.start();setRecording(true);setError('');}catch{setError('Нет доступа к микрофону. Разреши его в настройках браузера и повтори.');}};
 return <section className="voice-recorder"><h3>Запиши свой ответ</h3><p>Прослушай образец выше, запиши себя и сравни. Автоматической оценки произношения здесь нет. Запись остаётся на устройстве до закрытия страницы и не входит в резервную копию.</p><div className="section-actions"><button className={'button '+(recording?'primary':'secondary')} onClick={()=>{if(recording)recorder.current?.stop();else void start();}}>{recording?'● Остановить запись':'Включить микрофон и записать'}</button>{url&&!recording&&<a className="text-button" href={url} download="my-practice.webm">Скачать запись</a>}</div>{url&&<audio controls src={url}/>}<p role="status">{recording?'Идёт запись микрофона':error}</p></section>;
}
export function AudioStudio({episode,p,onSelect,onActivity,profile}:{profile:Profile;episode:Episode;p:Progress;onSelect:(id:string)=>void;onActivity:(id:string)=>void}){
 const [showText,setShowText]=useState(false),[translation,setTranslation]=useState(false),[playing,setPlaying]=useState<number|null>(null);const token=useRef(0);
 const {play:playAudio,stop:stopAudio,state,error}=useSpeechPlayer();
 const stop=()=>{token.current++;stopAudio();setPlaying(null);};
 useEffect(()=>{token.current++;stopAudio();setPlaying(null);return()=>{token.current++;stopAudio();};},[episode.id,p.voiceMaya,p.voiceOliver,p.speed,stopAudio]);
 const script:{text:string;ru:string;who:string;secondary:boolean}[]=[{text:episode.opening,ru:episode.openingRu,who:episode.mainSpeaker.name,secondary:false}];
 let id='start';const visited=new Set<string>();while(!visited.has(id)){visited.add(id);const n=episode.nodes[id];if(!n)break;script.push({text:n.text,ru:n.ru,who:episode.mainSpeaker.name,secondary:false});if(!n.choices.length)break;const historic=p.history.find(h=>h.node===id);const choice=n.choices.find(c=>c.text===historic?.reply)||n.choices[0];script.push({text:choice.text,ru:choice.label,who:'Ты',secondary:true});id=choice.next;}
 const play=async(index:number,all=false)=>{
  stop();const current=token.current;
  for(let i=index;i<script.length;i++){
   if(current!==token.current)return;setPlaying(i);const line=script[i];
   const completed=await playAudio('dialogue-'+i,{text:line.text,locale:episode.locale,voice:line.secondary?p.voiceOliver:p.voiceMaya,secondary:line.secondary,speed:p.speed,onCancel:()=>{if(current===token.current){token.current++;setPlaying(null);}}});
   if(current!==token.current)return;
   if(!completed){setPlaying(null);return;}
   if(!all)break;
  }
  if(current===token.current){setPlaying(null);if(all)onActivity('audio:'+episode.id);}
 };
 return <main className="study-page"><div className="eyebrow">АУДИОПРАКТИКА</div><h1>Услышь разговор целиком.</h1><AudioLibrary key={episode.language} language={episode.language} speed={p.speed} profile={profile}/><details className="voice-samples"><summary>Сравнить голоса на коротких образцах</summary><RecordedAudio language={episode.language} speed={p.speed} onActivity={onActivity}/></details><h2>Диалог по твоему маршруту</h2><p className="section-intro">Реплики двух участников. Используется выбранная ветка твоего разговора; до прохождения — один из возможных вариантов. <SpeechLabel voice={p.voiceMaya}/>.</p><label className="episode-selector">История<select value={episode.id} onChange={e=>{stop();setShowText(false);setTranslation(false);onSelect(e.target.value);}}>{episodes.filter(e=>e.language===episode.language).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><div className="section-actions"><button className="button primary" onClick={()=>playing===null?play(0,true):stop()}>{playing===null?'Слушать весь диалог':'Остановить'}</button><button className="text-button" onClick={()=>setShowText(!showText)}>{showText?'Скрыть реплики':'Показать реплики'}</button><button className="text-button" onClick={()=>setTranslation(!translation)}>{translation?'Скрыть перевод':'Показать перевод'}</button></div><p className="helper">Скорость {p.speed}×. Выбор голосов и скорости — в настройках звука.</p>{error&&<p className="warning">{error}</p>}<ol className="audio-lines">{script.map((line,i)=><li key={i} className={playing===i?'playing':''}><div><b>{line.who}</b><button className="text-button" onClick={()=>playing===i?stop():void play(i)}>{playing===i?(state?.phase==='loading'?'Готовим запись…':'Звучит…'):`Реплика ${i+1} · слушать`}</button></div>{showText&&<p lang={episode.language}>{line.text}</p>}{translation&&<small>{line.ru}</small>}</li>)}</ol><VoiceRecorder/></main>;
}
