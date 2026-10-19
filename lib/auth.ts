import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { getDb } from './db';

export type Account={id:string;label:string};
export const SESSION_COOKIE='slyshat_session';
export const FLOW_COOKIE='slyshat_oauth';
export const SESSION_SECONDS=30*24*60*60;
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function appUrl(){
  const u=new URL(process.env.APP_URL || 'http://localhost:3000');
  if(u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw new Error('APP_URL must be an origin.');
  if(u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('HTTPS is required outside localhost.');
  return u.origin;
}
export const cookieOptions=(maxAge:number)=>({httpOnly:true,secure:appUrl().startsWith('https:'),sameSite:'lax' as const,path:'/',maxAge});
export const oauthReady=()=>!!(process.env.YANDEX_CLIENT_ID&&process.env.YANDEX_CLIENT_SECRET);
export function sameOrigin(request:Request){return request.headers.get('origin')===appUrl();}
export function readCookie(request:Request,name:string){
  return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
}
export function accountFor(request:Request):Account|null{
  const token=readCookie(request,SESSION_COOKIE);
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const row=getDb().prepare('SELECT u.id,u.label FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now());
  return row?{id:String(row.id),label:String(row.label)}:null;
}
export function beginFlow(){
  if(!oauthReady())throw new Error('OAuth is not configured.');
  const db=getDb();db.prepare('DELETE FROM oauth_flows WHERE expires_at<?').run(Date.now());
  if(Number(db.prepare('SELECT count(*) AS n FROM oauth_flows').get()?.n)>1000)throw new Error('Too many pending sign-ins.');
  const state=randomBytes(32).toString('base64url');const verifier=randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO oauth_flows VALUES (?,?,?)').run(hash(state),verifier,Date.now()+600000);
  const url=new URL('https://oauth.yandex.ru/authorize');
  url.search=new URLSearchParams({response_type:'code',client_id:process.env.YANDEX_CLIENT_ID!,redirect_uri:appUrl()+'/api/auth/yandex/callback',scope:'login:info',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',force_confirm:'yes'}).toString();
  return {state,url:url.toString()};
}
export function consumeFlow(state:string,cookie:string):string|null{
  if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!cookie||!timingSafeEqual(Buffer.from(hash(state)),Buffer.from(hash(cookie))))return null;
  const row=getDb().prepare('DELETE FROM oauth_flows WHERE state_hash=? AND expires_at>? RETURNING verifier').get(hash(state),Date.now());
  return row?String(row.verifier):null;
}
export async function exchangeCode(code:string,verifier:string,fetcher:typeof fetch=fetch){
  const response=await fetcher('https://oauth.yandex.ru/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:process.env.YANDEX_CLIENT_ID!,client_secret:process.env.YANDEX_CLIENT_SECRET!,code_verifier:verifier}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok)throw new Error('Token exchange failed.');
  const token=await response.json();if(typeof token.access_token!=='string')throw new Error('Missing access token.');
  const profile=await fetcher('https://login.yandex.ru/info?format=json',{headers:{Authorization:'OAuth '+token.access_token},signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!profile.ok)throw new Error('Profile request failed.');
  const info=await profile.json();
  if(typeof info.id!=='string'||!/^\d{1,64}$/.test(info.id)||typeof info.login!=='string')throw new Error('Invalid profile.');
  const allowed=(process.env.YANDEX_ALLOWED_LOGINS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(allowed.length&&!allowed.includes(info.login.toLowerCase()))throw new Error('Account is not allowed.');
  return {yandexId:info.id,label:String(info.display_name||info.login).slice(0,100)};
}
export function createSession(profile:{yandexId:string;label:string}){
  const db=getDb();const token=randomBytes(32).toString('base64url');
  db.exec('BEGIN IMMEDIATE');
  try{
    db.prepare('INSERT INTO users VALUES (?,?,?,?) ON CONFLICT(yandex_id) DO UPDATE SET label=excluded.label').run(randomUUID(),profile.yandexId,profile.label,new Date().toISOString());
    const id=String(db.prepare('SELECT id FROM users WHERE yandex_id=?').get(profile.yandexId)!.id);
    db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),id,Date.now()+SESSION_SECONDS*1000);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 20)').run(id,id);
    db.exec('COMMIT');return token;
  }catch(e){db.exec('ROLLBACK');throw e;}
}
export function revokeSession(request:Request){const token=readCookie(request,SESSION_COOKIE);if(token)getDb().prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
