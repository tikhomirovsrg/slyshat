'use client';
import {useEffect,useState} from 'react';
import {StoryCourse} from './story-course';
import {usePreviewProfile} from './use-preview-profile';
import {previewHref,resolvePreviewStory,type PreviewOptions} from '../lib/preview-options';

export function StoryPreview({options}:{options:PreviewOptions}){
 const profile=usePreviewProfile();
 const [destination,setDestination]=useState<PreviewOptions>(options),[resolved,setResolved]=useState(!options.storyId),[error,setError]=useState('');
 const [speed,setSpeed]=useState(1),[reset,setReset]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setError('');setResolved(!options.storyId);
  void resolvePreviewStory(options,controller.signal).then(next=>{if(!controller.signal.aborted){setDestination(next);setResolved(true);window.history.replaceState(null,'',previewHref(next));}}).catch(cause=>{
   if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:'Не удалось открыть историю.');setDestination({...options,storyId:null});setResolved(true);}
  });
  return()=>controller.abort();
 },[options,retry]);
 const changeDestination=(next:PreviewOptions)=>{setError('');setDestination(next);window.history.replaceState(null,'',previewHref(next));};
 const clear=()=>{
  if(!window.confirm('Сбросить тестовое прохождение всех историй в этой вкладке?'))return;
  profile.reset();setReset(value=>value+1);
 };
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/" aria-label="Слышать, главная" style={{color:'inherit',textDecoration:'none'}}>слышать.</a><span>Тестовый просмотр</span><a className="button secondary" href="/" style={{color:'inherit'}}>Вернуться на сайт</a></header>
  <section className="profile-sync-note" aria-label="Тестовое прохождение"><p>Прогресс этой вкладки хранится отдельно от аккаунта.</p><p role="status">{profile.previewSaveNote}</p><button className="text-button" disabled={!profile.ready} onClick={clear}>Сбросить тестовое прохождение</button></section>
  {error&&<div className="warning" role="alert">{error} <button className="text-button" onClick={()=>setRetry(value=>value+1)}>Повторить</button></div>}
  {!profile.ready||!resolved?<main className="loading">Открываем истории…</main>:<StoryCourse key={destination.language+'-'+reset} language={destination.language} profile={profile} book={{}} speed={speed} onSpeed={setSpeed} onLanguage={language=>changeDestination({language,storyId:null})} initialStory={destination.storyId} onStoryOpen={storyId=>changeDestination({...destination,storyId})} onLeave={()=>changeDestination({...destination,storyId:null})}/>}
 </div>;
}
