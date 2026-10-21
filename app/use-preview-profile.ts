'use client';
import {useEffect,useRef,useState} from 'react';
import {freshProfile,validateProfile,type StudyProfile} from './profile-types';
import type {Profile} from './use-profile';
import {MAX_PROFILE_BYTES} from '../lib/profile-limits';

export const PREVIEW_PROFILE_KEY='slyshat-preview-v1';
type PreviewStorage=Pick<Storage,'getItem'|'setItem'>;

// This store has no account ID, remote fetcher, migration or upload path.
export class PreviewProfileStore{
 data=freshProfile();ready=false;storageAvailable=true;
 constructor(private storage:PreviewStorage,private changed:()=>void=()=>{}){}
 start(){
  try{
   const raw=this.storage.getItem(PREVIEW_PROFILE_KEY);
   if(raw){if(raw.length>MAX_PROFILE_BYTES)throw Error('Preview profile too large');this.data=validateProfile(JSON.parse(raw));}
  }catch{this.data=freshProfile();}
  this.ready=true;this.persist();
 }
 private persist(){
  try{this.storage.setItem(PREVIEW_PROFILE_KEY,JSON.stringify(this.data));this.storageAvailable=true;}catch{this.storageAvailable=false;}
  this.changed();
 }
 update(fn:(data:StudyProfile)=>StudyProfile){if(!this.ready)return;this.data=validateProfile(fn(this.data));this.persist();}
 reset(){this.data=freshProfile();this.persist();}
 snapshot(){return {data:this.data,ready:this.ready,previewSaveNote:this.storageAvailable?'Тестовый прогресс сохранён в этой вкладке':'Тестовый прогресс доступен до закрытия страницы'};}
}

export function usePreviewProfile():Profile&{reset:()=>void}{
 const store=useRef<PreviewProfileStore|null>(null);
 const [view,setView]=useState(()=>({data:freshProfile(),ready:false,previewSaveNote:'Открываем тестовое прохождение…'}));
 useEffect(()=>{
  const current=new PreviewProfileStore({getItem:key=>window.sessionStorage.getItem(key),setItem:(key,value)=>window.sessionStorage.setItem(key,value)},()=>setView(current.snapshot()));
  store.current=current;current.start();
  return()=>{store.current=null;};
 },[]);
 return {...view,accountId:undefined,status:'synced',conflict:false,
  update:fn=>store.current?.update(fn),refresh:async()=>{},resolve:()=>{},
  event:(id,points=1)=>store.current?.update(data=>({...data,events:[...data.events,{id:id+':'+crypto.randomUUID(),at:new Date().toISOString(),points}].slice(-2000)})),
  reset:()=>store.current?.reset(),
 };
}
