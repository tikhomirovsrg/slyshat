import {accountFor,sameOrigin,oauthReady} from '../../../lib/auth';
import {snapshot,saveRecord} from '../../../lib/progress-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(request:Request){
 try{const account=accountFor(request);if(!account)return json({error:'signin',oauthReady:oauthReady()},401);return json({account,...snapshot(account.id)});}
 catch{return json({error:'storage',message:'Хранилище временно недоступно.'},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'content_type'},415);
 try{
  const account=accountFor(request);if(!account)return json({error:'signin'},401);
  const reader=request.body?.getReader();if(!reader)return json({error:'empty'},400);
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return json({error:'too_large'},413);}chunks.push(value);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json({error:'json'},400);}
  if(input?.accountId!==account.id)return json({error:'account_changed'},409);
  let result;try{result=saveRecord(account.id,input);}catch(e){if(e instanceof Error&&!('code' in e))return json({error:'invalid_progress'},400);throw e;}
  return json({accountId:account.id,...result},result.conflict?409:200);
 }catch{return json({error:'storage',message:'Прогресс пока не отправлен. Повтори синхронизацию.'},503);}
}
