'use client';
import {useEffect} from 'react';
import {useSpeechPlayer} from './speech';
import manifest from '../public/audio/kokoro/manifest.json';
import type {Language} from './episodes';

const names:Record<string,string>={if_sara:'Sara',im_nicola:'Nicola',bf_emma:'Emma',bm_george:'George'};
export function RecordedAudio({language,speed,onActivity}:{language:Language;speed:number;onActivity:(id:string)=>void}){
  const {play,stop,state,error}=useSpeechPlayer();
  useEffect(()=>{stop();},[language,speed,stop]);
  const files=manifest.files.filter(f=>f.file.startsWith(language+'-')).sort((a,b)=>Number(b.file.includes('dialogue'))-Number(a.file.includes('dialogue')));
  return <section className="recorded-section" aria-labelledby="recorded-title">
    <div className="eyebrow">ГОТОВЫЕ ЗАПИСИ · БЕЗ КЛЮЧА API</div>
    <h2 id="recorded-title">Два голоса. Один разговор.</h2>
    <p>Послушай готовую ветку истории о встрече за кофе или сравни голоса на одной реплике. Здесь звучат заранее созданные нейроголоса Kokoro. Скорость {speed}×.</p>
    <div className="recorded-grid">{files.map(file=>{
      const dialogue=file.file.includes('dialogue');
      const title=dialogue?'Кофе · диалог по ролям':names[file.segments[0].voice];
      const url='/audio/kokoro/'+file.file;
      const selected=state?.id===file.file;
      return <article className={'recorded-card'+(dialogue?' recorded-dialogue':'')} key={file.file}>
        <div className="eyebrow">{dialogue?'ДИАЛОГ':file.segments[0].voice[1]==='f'?'ЖЕНСКИЙ ГОЛОС':'МУЖСКОЙ ГОЛОС'} · {Math.round(file.duration_seconds)} СЕК.</div>
        <h3>{title}</h3>
        <p>{dialogue?'Готовый вариант разговора. Его маршрут может отличаться от твоего прохождения.':'Та же начальная реплика истории — другим голосом.'}</p>
        <div className="section-actions">
          <button className={'button '+(dialogue?'primary':'secondary')+' small-button'} onClick={()=>{if(selected)stop();else void play(file.file,{source:url,text:file.segments.map(s=>s.text).join(' '),locale:language==='it'?'it-IT':'en-GB',speed,onEnd:()=>{if(dialogue)onActivity('recorded:'+file.file);}});}} aria-label={(selected?'Остановить: ':'Слушать: ')+title}>
            {selected?(state?.phase==='loading'?'Загрузка… · остановить':'Остановить'):'Слушать'}
          </button>
          <a className="text-button" href={url} download={file.file}>Скачать MP3</a>
        </div>
        <details className="recorded-transcript"><summary>Текст и перевод</summary>{file.segments.map((segment,index)=><div key={index}><b>{names[segment.voice]}</b><p lang={language}>{segment.text}</p><small>{segment.translation}</small></div>)}</details>
      </article>;
    })}</div>
    {error&&<p className="warning" role="alert">{error}</p>}
    <p className="helper" role="status">{state?'Воспроизводится готовая запись.':'Итальянский: Sara и Nicola. Английский: Emma и George. Это пробный набор из двух диалогов и четырёх образцов, не озвучка всех историй.'}</p>
  </section>;
}
