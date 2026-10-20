import path from 'node:path';
import {accountFor,sameOrigin} from '../../../lib/auth';
import {speechCatalog} from '../../../lib/speech-catalog';
import {SpeechService,SpeechError,dailyCharacterLimit} from '../../../lib/speech-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
let service:SpeechService|undefined;
export async function POST(request:Request){
  try{
    if(!sameOrigin(request))return Response.json({error:'origin'},{status:403,headers});
    if(!accountFor(request))return Response.json({error:'signin',message:'Войди в аккаунт, чтобы слушать записи.'},{status:401,headers});
    if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'content_type'},{status:415,headers});
    const reader=request.body?.getReader();if(!reader)throw new SpeechError('empty',400,'Нет реплики.');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();throw new SpeechError('too_large',413,'Реплика слишком длинная.');}chunks.push(value);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new SpeechError('json',400,'Не удалось прочитать запрос.');}
    if(!input||typeof input!=='object')throw new SpeechError('invalid',400,'Нет реплики.');
    if(process.env.TTS_PROVIDER!=='google')throw new SpeechError('not_configured',503,'Нейроозвучка ещё не подключена на сервере.');
    service??=new SpeechService({directory:process.env.AUDIO_CACHE_PATH||path.join(path.dirname(process.env.DATABASE_PATH||'./data/slyshat.sqlite'),'audio'),apiKey:process.env.GOOGLE_TTS_API_KEY?.trim()||'',dailyCharacters:dailyCharacterLimit(),catalog:speechCatalog});
    const audio=await service.speak(input);
    return new Response(new Uint8Array(audio),{headers:{...headers,'Content-Type':'audio/mpeg','Content-Length':String(audio.length)}});
  }catch(error){
    const known=error instanceof SpeechError;
    return Response.json({error:known?error.code:'audio_storage',message:known?error.message:'Аудио временно недоступно. Повтори позже.'},{status:known?error.status:503,headers:{...headers,...(known&&error.code==='busy'?{'Retry-After':'5'}:{})}});
  }
}
