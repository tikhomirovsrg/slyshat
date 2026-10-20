import {episodes} from '../app/episodes';
import {getPack} from '../app/packs';
import {extraQuestions} from '../app/extra-practice';

// A paid synthesis endpoint accepts only published learning material, never
// arbitrary user text, writing drafts, names or microphone recordings.
export function buildSpeechCatalog(){
  const catalog=new Map<string,Set<string>>();
  const add=(locale:string,text:string)=>{
    const set=catalog.get(locale)||new Set<string>();
    set.add(text);
    for(const part of text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[])set.add(part.trim());
    catalog.set(locale,set);
  };
  for(const e of episodes){
    for(const text of [e.opening,e.checkText,...e.phrases.flatMap(p=>[p.text,p.part,p.example]),...e.transfer.map(t=>t.text)])add(e.locale,text);
    for(const n of Object.values(e.nodes))for(const text of [n.text,...n.choices.map(c=>c.text)])add(e.locale,text);
    for(const q of [...(getPack(e.id)?.exercises||[]),...extraQuestions(e.id)])if(q.audio)add(q.audio.locale,q.audio.text);
  }
  return catalog;
}
export const speechCatalog=buildSpeechCatalog();
