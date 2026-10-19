'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {SyncEngine} from './sync-engine';
import {fresh,loadProgress,type Progress} from './learning';
import {episodes} from './episodes';
export function useStudyProgress(){
 const engine=useRef<SyncEngine|null>(null);
 const [view,setView]=useState(()=>new SyncEngine({getItem:()=>null,setItem:()=>{}},fetch,async()=>({}),false).view());
 useEffect(()=>{
  const storage={getItem:(key:string)=>window.localStorage.getItem(key),setItem:(key:string,value:string)=>window.localStorage.setItem(key,value)};
  const e=new SyncEngine(storage,fetch,async()=>Object.fromEntries(await Promise.all(episodes.map(async x=>[x.id,await loadProgress(x.id)||fresh(x.id)]))));engine.current=e;
  const unsubscribe=e.subscribe(()=>setView(e.view()));void e.start();
  const refresh=()=>{if(document.visibilityState==='visible')void e.refresh();};
  const online=()=>void e.refresh();window.addEventListener('online',online);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,30000);
  const leaving=(event:BeforeUnloadEvent)=>{if(e.view().status==='pending'||e.view().status==='saving'||Object.values(e.rows).some(r=>r.dirty)){event.preventDefault();}};
  window.addEventListener('beforeunload',leaving);
  return()=>{clearInterval(timer);window.removeEventListener('online',online);window.removeEventListener('focus',refresh);window.removeEventListener('beforeunload',leaving);document.removeEventListener('visibilitychange',refresh);unsubscribe();e.stop();};
 },[]);
 const setP=useCallback((value:Progress|((old:Progress)=>Progress))=>engine.current?.update(value),[]);
 return {...view,setP,updateEpisode:(id:string,fn:(p:Progress)=>Progress)=>engine.current?.update(fn,id),select:(id:string,start=false)=>engine.current?.select(id,start),refresh:()=>engine.current?.refresh(),importRecords:(rows:Record<string,Progress>,active:string)=>engine.current?.importRecords(rows,active),importLegacy:()=>engine.current?.importLegacy(),dismissLegacy:()=>engine.current?.dismissLegacy(),resolve:(id:string,c:'local'|'remote')=>engine.current?.resolve(id,c)};
}
