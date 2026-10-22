import {courseStory,storyCatalog} from '../../../lib/story-course';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 try{if(p.has('id')){const story=courseStory(p.get('id')!);return Response.json(story||{error:'not_found'},{status:story?200:404});}
 const language=p.get('language')||'en';if(!['en','it'].includes(language))return Response.json({error:'language'},{status:400});
 return Response.json(storyCatalog(language,p.get('includeArchived')==='1'));
 }catch{return Response.json({error:'course_unavailable',message:'Не удалось открыть истории. Попробуй ещё раз.'},{status:503});}
}
