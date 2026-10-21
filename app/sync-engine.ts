import {requestJson} from '../lib/client-request';
import {episodes} from './episodes';
import {fresh,validateProgress,type Progress} from './learning';
import type {RemoteRecord,Run} from '../lib/progress-store';
export type Account={id:string;label:string};
type SnapshotResponse={account:Account;records:RemoteRecord[];history:Run[]};
type SaveResponse={accountId?:string;conflict?:boolean;record?:RemoteRecord|null;error?:string};
type LocalRecord={progress:Progress;baseRevision:number;mutationId:string;dirty:boolean;updatedAt:string;conflict?:RemoteRecord|null};
export type SyncStatus='loading'|'synced'|'pending'|'saving'|'offline'|'signin'|'error'|'conflict';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
const meaningful=(p:Progress)=>p.started||p.saved.length>0||Object.keys(p.attempts).length>0;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const fromRemote=(r:RemoteRecord):LocalRecord=>({progress:validateProgress(r.progress),baseRevision:r.revision,mutationId:r.mutationId,dirty:false,updatedAt:r.updatedAt});
const asRemote=(r:LocalRecord):RemoteRecord=>({progress:r.progress,revision:r.baseRevision,mutationId:r.mutationId,updatedAt:r.updatedAt});
const id=()=>crypto.randomUUID();
export class SyncEngine {
 rows:Record<string,LocalRecord>={};account:Account|null=null;active='coffee-01';history:Run[]=[];legacy:Record<string,Progress>={};
 status:SyncStatus='loading';loaded=false;oauthReady=false;localDurable=true;
 private verified=false;private busy=false;private refreshing=false;private stopped=false;private timer:ReturnType<typeof setTimeout>|null=null;
 private listeners=new Set<()=>void>();
 constructor(private storage:Storage,private request:typeof fetch,private loadLegacy:()=>Promise<Record<string,Progress>>,private auto=true){}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 private emit(){for(const fn of this.listeners)fn();}
 private get(key:string){try{return this.storage.getItem(key);}catch{return null;}}
 private put(key:string,value:string){try{this.storage.setItem(key,value);return true;}catch{this.localDurable=false;return false;}}
 private cacheKey(userId:string){return 'slyshat-cloud-v1:'+userId;}
 private persist(){if(this.account){this.put(this.cacheKey(this.account.id),JSON.stringify({rows:this.rows,active:this.active,account:this.account,history:this.history}));this.put('slyshat-cloud-last',this.account.id);}}
 private loadCache(userId:string){
  this.rows={};this.history=[];this.active='coffee-01';
  try{const c=JSON.parse(this.get(this.cacheKey(userId))||'null');if(!c||c.account?.id!==userId)return;
   for(const [key,v] of Object.entries(c.rows||{})){const r=v as LocalRecord;const p=validateProgress(r.progress);if(key!==p.episode||!Number.isSafeInteger(r.baseRevision)||r.baseRevision<0||typeof r.mutationId!=='string'||typeof r.dirty!=='boolean')continue;
    this.rows[key]={...r,progress:p};}
   if(episodes.some(e=>e.id===c.active))this.active=c.active;
   this.account={id:userId,label:String(c.account.label)};if(Array.isArray(c.history))this.history=c.history;
  }catch{this.rows={};}
 }
 get p(){return this.rows[this.active]?.progress||fresh(this.active);}
 get book(){return Object.fromEntries(episodes.map(e=>[e.id,this.rows[e.id]?.progress||fresh(e.id)]));}
 get conflicts(){return Object.entries(this.rows).filter(([,r])=>r.conflict!==undefined).map(([episode,r])=>({episode,local:r.progress,remote:r.conflict?.progress||fresh(episode)}));}
 get migrationCount(){if(!this.account||this.get('slyshat-imported:'+this.account.id)==='yes')return 0;const owner=this.get('slyshat-legacy-owner');if(owner&&owner!==this.account.id)return 0;return Object.values(this.legacy).filter(meaningful).length;}
 view(){return {p:this.p,book:this.book,account:this.account,loaded:this.loaded,status:this.status,history:this.history,conflicts:this.conflicts,migrationCount:this.migrationCount,oauthReady:this.oauthReady,localDurable:this.localDurable};}
 async start(){try{this.legacy=await this.loadLegacy();}catch{}if(!this.stopped)await this.refresh();}
 stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);this.listeners.clear();}
 private settled(){this.status=this.conflicts.length?'conflict':Object.values(this.rows).some(r=>r.dirty)?'pending':'synced';}
 private queue(){if(!this.auto||this.stopped)return;if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.flush();},650);}
 async refresh(){
  if(this.stopped||this.refreshing||this.busy)return;this.refreshing=true;
  try{
   const {response,data}=await requestJson<SnapshotResponse&{oauthReady?:boolean}>(this.request,'/api/progress',{cache:'no-store'});
   if(response.status===401){this.oauthReady=!!data.oauthReady;this.verified=false;this.account=null;this.rows={};this.history=[];this.status='signin';return;}
   if(!response.ok)throw new Error('Unavailable');
   if(!data.account?.id||!Array.isArray(data.records)||!Array.isArray(data.history))throw new Error('Invalid snapshot');
   if(this.stopped)return;
   const changed=this.account?.id!==data.account.id;
   if(changed)this.loadCache(data.account.id);
   this.account=data.account;this.verified=true;this.oauthReady=true;
   for(const remote of data.records as RemoteRecord[]){const k=remote.progress.episode;const local=this.rows[k];
    if(!local||!local.dirty||same(local.progress,remote.progress)){this.rows[k]=fromRemote(remote);}
    else if(local.baseRevision!==remote.revision){this.rows[k]={...local,conflict:remote};}
   }
   if(changed&&Object.keys(this.rows).length&& !this.rows[this.active])this.active=(data.records[0] as RemoteRecord|undefined)?.progress.episode||this.active;
   this.history=data.history;this.settled();this.persist();this.queue();
  }catch{
   if(!this.account){const last=this.get('slyshat-cloud-last');if(last)this.loadCache(last);}
   this.verified=false;this.status='offline';
  }finally{this.refreshing=false;this.loaded=true;if(!this.stopped)this.emit();}
 }
 update(value:Progress|((old:Progress)=>Progress),episode=this.active){
  const p=validateProgress(typeof value==='function'?value(this.rows[episode]?.progress||fresh(episode)):value);const old=this.rows[p.episode];
  if(same(old?.progress||fresh(p.episode),p))return;
  this.rows[p.episode]={progress:p,baseRevision:old?.baseRevision||0,mutationId:id(),dirty:true,updatedAt:old?.updatedAt||'',...(old?.conflict!==undefined?{conflict:old.conflict}:{})};
  if(this.verified)this.settled();this.persist();this.emit();this.queue();
 }
 select(episode:string,start=false){if(!episodes.some(e=>e.id===episode))return;this.active=episode;if(start)this.update(s=>({...s,started:true}));this.persist();this.emit();}
 importRecords(records:Record<string,Progress>,active=this.active,protectExisting=false){
  for(const [key,raw] of Object.entries(records)){const p=validateProgress(raw);if(p.episode!==key)throw new Error('История не совпадает.');const old=this.rows[key];
   if(same(old?.progress,p))continue;
   this.rows[key]={progress:p,baseRevision:old?.baseRevision||0,mutationId:id(),dirty:true,updatedAt:old?.updatedAt||'',...(protectExisting&&old&&meaningful(old.progress)?{conflict:old.conflict??asRemote(old)}:{})};
  }
  if(episodes.some(e=>e.id===active))this.active=active;this.settled();this.persist();this.emit();this.queue();
 }
 importLegacy(){if(!this.account)return;this.importRecords(Object.fromEntries(Object.entries(this.legacy).filter(([,p])=>meaningful(p))),this.active,true);this.put('slyshat-imported:'+this.account.id,'yes');this.put('slyshat-legacy-owner',this.account.id);this.emit();}
 dismissLegacy(){if(this.account)this.put('slyshat-imported:'+this.account.id,'yes');this.emit();}
 resolve(episode:string,choice:'local'|'remote'){
  const row=this.rows[episode];if(!row||row.conflict===undefined)return;
  const remote=row.conflict;
  if(choice==='remote'){if(remote)this.rows[episode]=fromRemote(remote);else delete this.rows[episode];}
  else{this.rows[episode]={...row,baseRevision:remote?.revision||0,mutationId:id(),dirty:true};delete this.rows[episode].conflict;}
  this.settled();this.persist();this.emit();this.queue();
 }
 async flush(){
  if(this.stopped||this.busy||!this.account||!this.verified)return;
  this.busy=true;const accountId=this.account.id;
  try{
   for(let n=0;n<episodes.length*2;n++){
    const item=Object.entries(this.rows).find(([,r])=>r.dirty&&r.conflict===undefined);if(!item)break;
    const [episode,sent]=item;this.status='saving';this.emit();
    const {response,data:body}=await requestJson<SaveResponse>(this.request,'/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId,progress:sent.progress,baseRevision:sent.baseRevision,mutationId:sent.mutationId})});
    if(this.stopped||this.account?.id!==accountId)return;
    if(response.status===401||body.error==='account_changed'){this.verified=false;this.status='signin';return;}
    if(response.status===409&&body.conflict){this.rows[episode]={...this.rows[episode],conflict:body.record??null};this.persist();continue;}
    if(!response.ok||body.accountId!==accountId||!body.record)throw new Error('Save failed');
    const current=this.rows[episode];const remote=body.record as RemoteRecord;
    if(current.mutationId===sent.mutationId)this.rows[episode]=fromRemote(remote);
    else this.rows[episode]={...current,baseRevision:remote.revision,updatedAt:remote.updatedAt};
    const p=sent.progress;if(p.finishedAt&&p.phase==='done'){
     const values=Object.values(p.results);const run={episode:p.episode,finishedAt:p.finishedAt,correct:values.filter(r=>r.correct).length,independent:values.filter(r=>r.correct&&r.withoutText).length,total:values.length};
     this.history=[run,...this.history.filter(r=>!(r.episode===run.episode&&r.finishedAt===run.finishedAt))].sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)).slice(0,100);
    }
    this.persist();
   }
   this.settled();
  }catch{this.status='offline';this.verified=false;}
  finally{this.busy=false;this.persist();if(!this.stopped){this.emit();if(this.verified&&Object.values(this.rows).some(r=>r.dirty&&r.conflict===undefined))this.queue();}}
 }
}
