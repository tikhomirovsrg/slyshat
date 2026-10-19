import { getDb } from './db';
import { validateProgress, type Progress } from '../app/learning';
import { episodes } from '../app/episodes';
export class InvalidProgress extends Error {}
export type RemoteRecord={progress:Progress;revision:number;mutationId:string;updatedAt:string};
export type Run={episode:string;finishedAt:string;correct:number;independent:number;total:number};
function decode(row:Record<string,unknown>):RemoteRecord{return {progress:validateProgress(JSON.parse(String(row.data))),revision:Number(row.revision),mutationId:String(row.mutation_id),updatedAt:String(row.updated_at)};}
export function snapshot(userId:string){
 const db=getDb();
 return {
  records:db.prepare('SELECT * FROM progress WHERE user_id=? ORDER BY updated_at DESC').all(userId).map(decode),
  history:db.prepare('SELECT episode,finished_at AS finishedAt,correct,independent,total FROM runs WHERE user_id=? ORDER BY finished_at DESC LIMIT 100').all(userId) as Run[],
 };
}
export function saveRecord(userId:string,input:unknown):{conflict:boolean;record:RemoteRecord|null}{
 const v=input as {progress:unknown;baseRevision:number;mutationId:string};
 if(!v||!Number.isSafeInteger(v.baseRevision)||v.baseRevision<0||typeof v.mutationId!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(v.mutationId))throw new Error('Invalid save request.');
 const p=validateProgress(v.progress);
 const data=JSON.stringify(p);if(data.length>60000)throw new Error('Progress is too large.');
 if(p.finishedAt!==null&&(!Number.isFinite(Date.parse(p.finishedAt))||p.finishedAt!==new Date(p.finishedAt).toISOString()))throw new Error('Invalid completion time.');
 const db=getDb();db.exec('BEGIN IMMEDIATE');
 try{
  const row=db.prepare('SELECT * FROM progress WHERE user_id=? AND episode=?').get(userId,p.episode);
  const current=row?decode(row):null;
  if(current?.mutationId===v.mutationId){db.exec('COMMIT');return {conflict:false,record:current};}
  if((current?.revision||0)!==v.baseRevision){db.exec('COMMIT');return {conflict:true,record:current};}
  const updatedAt=new Date().toISOString(),revision=v.baseRevision+1;
  db.prepare('INSERT INTO progress VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,episode) DO UPDATE SET data=excluded.data,revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at').run(userId,p.episode,data,revision,v.mutationId,updatedAt);
  if(p.finishedAt&&p.phase==='done'){
   const e=episodes.find(e=>e.id===p.episode)!;const rs=e.transfer.map(q=>({q,r:p.results[q.id]})).filter(x=>x.r);
   const correct=rs.filter(x=>x.r.choice===x.q.answer).length;
   const independent=rs.filter(x=>x.r.choice===x.q.answer&&x.r.withoutText&&x.r.listened).length;
   db.prepare('INSERT OR IGNORE INTO runs VALUES (?,?,?,?,?,?)').run(userId,p.episode,p.finishedAt,correct,independent,rs.length);
  }
  db.exec('COMMIT');return {conflict:false,record:{progress:p,revision,mutationId:v.mutationId,updatedAt}};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
