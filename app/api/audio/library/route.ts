import {audioCatalog,audioStory} from '../../../../lib/audio-library';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,id=params.get('id');
  if(id){const story=audioStory(id);return story?Response.json(story):Response.json({message:'История не найдена.'},{status:404});}
  return Response.json(audioCatalog(params));
 }catch{return Response.json({message:'Каталог аудио пока недоступен. Попробуй обновить страницу.'},{status:503});}
}
