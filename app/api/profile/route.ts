import {accountFor,sameOrigin} from '../../../lib/auth';
import {profileStore} from '../../../lib/profile-store';
import {InvalidProgress} from '../../../lib/progress-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(request:Request){try{const user=accountFor(request);if(!user)return json({error:'signin'},401);return json({accountId:user.id,record:await profileStore().get(user.id)});}catch{return json({error:'storage'},503);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return json({error:'origin'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'type'},415);
 try{const user=accountFor(request);if(!user)return json({error:'signin'},401);const reader=request.body?.getReader();if(!reader)return json({error:'empty'},400);let size=0,text='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>650000){await reader.cancel();return json({error:'too_large'},413);}text+=decoder.decode(value,{stream:true});}let input;try{input=JSON.parse(text+decoder.decode());}catch{return json({error:'json'},400);}if(input?.accountId!==user.id)return json({error:'account_changed'},409);const result=await profileStore().save(user.id,input);return json({accountId:user.id,...result},result.conflict?409:200);}catch(e){return json({error:e instanceof InvalidProgress?'invalid':'storage'},e instanceof InvalidProgress?400:503);}
}
