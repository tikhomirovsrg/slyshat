import type {Language} from '../app/episodes';

export type PreviewOptions={language:Language;storyId:string|null};

export function previewOptions(search:string):PreviewOptions|null{
 const params=new URLSearchParams(search);
 if(params.get('preview')!=='1')return null;
 const story=params.get('story');
 return {language:params.get('lang')==='it'?'it':'en',storyId:story&&/^[a-zA-Z0-9_-]{1,120}$/.test(story)?story:null};
}

export function previewHref(options:PreviewOptions){
 const params=new URLSearchParams({preview:'1',lang:options.language});
 if(options.storyId)params.set('story',options.storyId);
 return '/?'+params;
}

// Resolve the actual language before mounting a course: its next-story order
// comes from the language catalog, including for old story IDs such as coffee-it.
export async function resolvePreviewStory(options:PreviewOptions,signal:AbortSignal,request:typeof fetch=fetch):Promise<PreviewOptions>{
 if(!options.storyId)return options;
 const response=await request('/api/stories?'+new URLSearchParams({id:options.storyId}),{signal,credentials:'omit'});
 if(!response.ok)throw Error(response.status===404?'История по этой ссылке не найдена.':'Не удалось открыть историю по ссылке.');
 const story=await response.json();
 if(story.id!==options.storyId||!['en','it'].includes(story.language))throw Error('Не удалось прочитать историю по ссылке.');
 return {...options,language:story.language};
}
