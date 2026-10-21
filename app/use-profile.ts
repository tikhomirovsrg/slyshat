'use client';
import {requestJson} from '../lib/client-request';
import {useEffect,useRef,useState} from 'react';
import {freshProfile,validateProfile,type StudyProfile} from './profile-types';
import type {ProfileRecord} from '../lib/profile-store';
import type {SyncStatus} from './sync-engine';
type Row={data:StudyProfile;baseRevision:number;mutationId:string;dirty:boolean;conflict?:ProfileRecord};
const empty=():Row=>({data:freshProfile(),baseRevision:0,mutationId:'',dirty:false});
export class ProfileSync{
 row=empty();status:SyncStatus='loading';ready=false;private busy=false;private stopped=false;private verified=false;private timer:ReturnType<typeof setTimeout>|null=null;
 constructor(readonly accountId:string,private storage:Pick<Storage,'getItem'|'setItem'>,private request:typeof fetch,private changed:()=>void,private auto=true){}
 private key(){return 'slyshat-profile-v1:'+this.accountId;}
 private emit(){try{this.storage.setItem(this.key(),JSON.stringify(this.row));}catch{}this.changed();}
 private queue(){if(!this.auto||this.stopped)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),650);}
 async start(){try{const raw=JSON.parse(this.storage.getItem(this.key())||'null');if(raw&&Number.isSafeInteger(raw.baseRevision)&&raw.baseRevision>=0&&typeof raw.dirty==='boolean'){this.row={...raw,data:validateProfile(raw.data)};}}catch{}await this.refresh();}
 stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);}
 async refresh(){if(this.stopped||this.busy)return;this.busy=true;try{const {response:res,data:body}=await requestJson<{accountId?:string;record?:ProfileRecord}>(this.request,'/api/profile',{cache:'no-store'});if(res.status===401){this.status='signin';this.verified=false;return;}if(!res.ok||!body.record)throw Error();if(body.accountId!==this.accountId){this.status='signin';this.verified=false;return;}const r=body.record;validateProfile(r.data);if(this.stopped)return;this.verified=true;
 if(!this.row.dirty||this.row.mutationId===r.mutationId)this.row={data:r.data,baseRevision:r.revision,mutationId:r.mutationId,dirty:false};else if(this.row.baseRevision!==r.revision)this.row.conflict=r;
 this.status=this.row.conflict?'conflict':this.row.dirty?'pending':'synced';this.queue();
 }catch{this.verified=false;this.status='offline';}finally{this.busy=false;this.ready=true;if(!this.stopped)this.emit();}}
 update(fn:(p:StudyProfile)=>StudyProfile){this.row={...this.row,data:validateProfile(fn(this.row.data)),mutationId:crypto.randomUUID(),dirty:true};this.status=this.row.conflict?'conflict':this.verified?'pending':'offline';this.emit();this.queue();}
 resolve(local:boolean){const remote=this.row.conflict;if(!remote)return;this.row=local?{data:this.row.data,baseRevision:remote.revision,mutationId:crypto.randomUUID(),dirty:true}:{data:remote.data,baseRevision:remote.revision,mutationId:remote.mutationId,dirty:false};this.status=this.row.dirty?'pending':'synced';this.emit();this.queue();}
 async flush(){if(this.busy||this.stopped||!this.verified||!this.row.dirty||this.row.conflict)return;this.busy=true;const sent=this.row;this.status='saving';this.emit();try{const {response:res,data:body}=await requestJson<{accountId?:string;record?:ProfileRecord;conflict?:boolean;error?:string}>(this.request,'/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:this.accountId,data:sent.data,baseRevision:sent.baseRevision,mutationId:sent.mutationId})});if(this.stopped)return;if(res.status===401||body.error==='account_changed'){this.verified=false;this.status='signin';return;}if(res.status===409&&body.conflict&&body.record){this.row.conflict=body.record;this.status='conflict';return;}if(!res.ok||body.accountId!==this.accountId||!body.record)throw Error();this.row=this.row.mutationId===sent.mutationId?{data:body.record.data,baseRevision:body.record.revision,mutationId:body.record.mutationId,dirty:false}:{...this.row,baseRevision:body.record.revision};this.status=this.row.dirty?'pending':'synced';}catch{this.verified=false;this.status='offline';}finally{this.busy=false;if(!this.stopped){this.emit();if(this.verified&&this.row.dirty&&!this.row.conflict)this.queue();}}}
}
export function useProfile(accountId?:string){
 const engine=useRef<ProfileSync|null>(null);const [view,setView]=useState({accountId:undefined as string|undefined,data:freshProfile(),status:'loading' as SyncStatus,ready:false,conflict:false});
 useEffect(()=>{if(!accountId){engine.current=null;setView({accountId:undefined,data:freshProfile(),status:'loading',ready:false,conflict:false});return;}const s=new ProfileSync(accountId,{getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)},fetch,()=>setView({accountId,data:s.row.data,status:s.status,ready:s.ready,conflict:!!s.row.conflict}));engine.current=s;void s.start();const refresh=()=>{if(document.visibilityState==='visible')void s.refresh();};const interval=setInterval(refresh,30000);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);const leaving=(e:BeforeUnloadEvent)=>{if(s.row.dirty)e.preventDefault();};window.addEventListener('beforeunload',leaving);return()=>{s.stop();clearInterval(interval);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('beforeunload',leaving);};},[accountId]);
 const visible=view.accountId===accountId?view:{accountId,data:freshProfile(),status:'loading' as SyncStatus,ready:false,conflict:false};
 const current=()=>engine.current?.accountId===accountId?engine.current:null;
 return {...visible,update:(fn:(p:StudyProfile)=>StudyProfile)=>current()?.update(fn),refresh:()=>current()?.refresh(),resolve:(local:boolean)=>current()?.resolve(local),event:(id:string,points=1)=>current()?.update(p=>({...p,events:[...p.events,{id:id+':'+crypto.randomUUID(),at:new Date().toISOString(),points}].slice(-2000)}))};
}
export type Profile=ReturnType<typeof useProfile>;
