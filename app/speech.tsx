'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {initialSpeechConfig,speechLabel,type SpeechConfig} from '../lib/speech-config';
import {playSpeech,type Playback,type PlaybackOptions} from '../lib/speech-player';

const SpeechContext=createContext<{config:SpeechConfig;voices:SpeechSynthesisVoice[]}>({config:initialSpeechConfig,voices:[]});
export function SpeechProvider({children}:{children:ReactNode}){
  const [config,setConfig]=useState(initialSpeechConfig),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/audio/config',{signal:controller.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(!controller.signal.aborted)setConfig(data);}).catch(()=>{if(!controller.signal.aborted)setConfig({...initialSpeechConfig,message:'Не удалось проверить нейроозвучку. Обнови страницу; доступны системные голоса.'});});
    const update=()=>setVoices(window.speechSynthesis?.getVoices()||[]);
    update();window.speechSynthesis?.addEventListener('voiceschanged',update);
    return()=>{controller.abort();window.speechSynthesis?.removeEventListener('voiceschanged',update);};
  },[]);
  return <SpeechContext.Provider value={{config,voices}}>{children}</SpeechContext.Provider>;
}
export const useSpeechConfig=()=>useContext(SpeechContext);
export function SpeechLabel({voice=''}:{voice?:string}){const {config}=useSpeechConfig();return <>{speechLabel(voice,config)}</>;}
export function useSpeechPlayer(){
  const {config}=useSpeechConfig();
  const [state,setState]=useState<{id:string;phase:'loading'|'playing'}|null>(null);
  const [error,setError]=useState('');
  const handle=useRef<Playback|null>(null);
  const stop=useCallback(()=>{handle.current?.stop();handle.current=null;setState(null);},[]);
  const setPlaybackSpeed=useCallback((speed:number)=>handle.current?.setSpeed(speed)??false,[]);
  useEffect(()=>()=>{handle.current?.stop();},[]);
  const play=useCallback((id:string,options:Omit<PlaybackOptions,'config'>)=>{
    setError('');
    // Stop first: the previous owner's cancellation callback clears its state.
    handle.current?.stop();setState({id,phase:'loading'});
    handle.current=playSpeech({...options,config,
      onStart:()=>{setState({id,phase:'playing'});options.onStart?.();},
      onEnd:()=>{setState(null);options.onEnd?.();},
      onCancel:()=>{setState(null);options.onCancel?.();},
      onError:message=>{setState(null);setError(message);options.onError?.(message);},
    });
    return handle.current.done;
  },[config]);
  return {play,stop,setPlaybackSpeed,state,error};
}
