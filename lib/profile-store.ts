import {getDb} from './db';
import {validateProfile,type StudyProfile,freshProfile} from '../app/profile-types';
import {InvalidProgress} from './progress-store';
export type ProfileRecord={data:StudyProfile;revision:number;mutationId:string;updatedAt:string};
const decode=(r:Record<string,unknown>):ProfileRecord=>({data:validateProfile(JSON.parse(String(r.data))),revision:Number(r.revision),mutationId:String(r.mutation_id),updatedAt:String(r.updated_at)});
export const emptyProfile=():ProfileRecord=>({data:freshProfile(),revision:0,mutationId:'',updatedAt:''});
export function profileStore(){return {
 get(userId:string){const row=getDb().prepare('SELECT * FROM study_profiles WHERE user_id=?').get(userId);return row?decode(row):emptyProfile();},
 save(userId:string,input:unknown){const v=input as {data:StudyProfile;baseRevision:number;mutationId:string};let data:string;
  try{if(!v||!Number.isSafeInteger(v.baseRevision)||v.baseRevision<0||typeof v.mutationId!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(v.mutationId))throw Error();data=JSON.stringify(validateProfile(v.data));if(data.length>600000)throw Error();}catch{throw new InvalidProgress('Invalid profile');}
  const db=getDb();db.exec('BEGIN IMMEDIATE');try{
   const row=db.prepare('SELECT * FROM study_profiles WHERE user_id=?').get(userId),current=row?decode(row):emptyProfile();
   if(current.mutationId===v.mutationId){db.exec('COMMIT');return {record:current,conflict:false};}
   if(current.revision!==v.baseRevision){db.exec('COMMIT');return {record:current,conflict:true};}
   const updatedAt=new Date().toISOString(),revision=v.baseRevision+1;
   db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at').run(userId,data,revision,v.mutationId,updatedAt);
   db.exec('COMMIT');return {record:{data:JSON.parse(data) as StudyProfile,revision,mutationId:v.mutationId,updatedAt},conflict:false};
  }catch(e){db.exec('ROLLBACK');throw e;}
 },
};}
