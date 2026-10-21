import type {CourseStory,Journey,JourneyProgress,StoryCard} from '../lib/story-course-types';
import type {Progress} from './learning';
export const newJourneyProgress=():JourneyProgress=>({path:[],heard:[],assisted:[],finishedAt:null,updatedAt:new Date().toISOString()});
export function storyRoute(story:Pick<CourseStory,'start'|'nodes'>,path:number[]){
 const route=[story.start];let id=story.start;
 for(const choice of path){const next=story.nodes[id]?.choices[choice]?.next;if(!next)throw Error('Invalid story path');id=next;route.push(id);}
 return route;
}
export function validateJourney(value:unknown):Journey{
 const j=value as Journey;if(!j||!j.active||typeof j.active!=='object'||Array.isArray(j.active)||Object.keys(j.active).some(k=>!['en','it'].includes(k))||!j.stories||typeof j.stories!=='object'||Array.isArray(j.stories)||Object.keys(j.stories).length>2000)throw Error('Invalid story journey');
 const validId=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(s);
 for(const id of Object.values(j.active))if(!validId(id))throw Error('Invalid active story');
 for(const [id,p] of Object.entries(j.stories)){
  if(!validId(id)||!p||!Array.isArray(p.path)||p.path.length>40||p.path.some(n=>!Number.isInteger(n)||n<0||n>9)||!Array.isArray(p.heard)||!Array.isArray(p.assisted)||[p.heard,p.assisted].some(a=>a.length>50||new Set(a).size!==a.length||a.some(n=>!validId(n)))||!Number.isFinite(Date.parse(p.updatedAt))||!(p.finishedAt===null||Number.isFinite(Date.parse(p.finishedAt))))throw Error('Invalid story journey progress');
  if((p.completedAt!==undefined&&!Number.isFinite(Date.parse(p.completedAt)))||(p.endings!==undefined&&(!Array.isArray(p.endings)||p.endings.length>40||new Set(p.endings).size!==p.endings.length||p.endings.some(n=>!validId(n)))))throw Error('Invalid story endings');
 }
 return j;
}
// Original story records stay untouched. The course can continue their chosen route.
export function legacyJourney(story:CourseStory,old?:Progress):JourneyProgress{
 const p=newJourneyProgress();if(!old?.started)return p;
 let id=story.start;
 for(const step of old.history){if(step.node!==id)break;const index=story.nodes[id].choices.findIndex(c=>c.text===step.reply);if(index<0)break;p.path.push(index);id=story.nodes[id].choices[index].next;}
 if(id!==old.node&&story.nodes[old.node]&&(old.phase==='dialogue'||old.finishedAt)){
  const find=(node:string,path:number[]):number[]|null=>{if(node===old.node)return path;for(let i=0;i<story.nodes[node].choices.length;i++){const result=find(story.nodes[node].choices[i].next,[...path,i]);if(result)return result;}return null;};
  const recovered=find(story.start,[]);if(recovered){p.path=recovered;id=old.node;}
 }
 if(old.finishedAt)p.completedAt=old.finishedAt;
 if(old.finishedAt&&!story.nodes[id].choices.length)p.finishedAt=old.finishedAt;
 const route=storyRoute(story,p.path);
 for(const node of route){const a=old.attempts[node]||old.attempts['dialogue-'+node];if(a?.plays)p.heard.push(node);if(a?.text||a?.translation)p.assisted.push(node);}
 return p;
}
export function storyFinished(card:StoryCard,journey?:Journey,book?:Record<string,Progress>){return !!journey?.stories[card.id]?.completedAt||!!journey?.stories[card.id]?.finishedAt||(!journey?.stories[card.id]&&!!book?.[card.id]?.finishedAt);}
export function nextStory(items:StoryCard[],currentId:string){const i=items.findIndex(s=>s.id===currentId);return i<0?null:items[i+1]||null;}
export function resumeStory(items:StoryCard[],journey?:Journey,book?:Record<string,Progress>){
 const lang=items[0]?.language,active=lang&&journey?.active[lang];const current=items.find(s=>s.id===active);
 if(current&&(journey?.stories[current.id]?.finishedAt===null||!storyFinished(current,journey,book)))return current;
 if(current){const next=nextStory(items,current.id);if(next&&!storyFinished(next,journey,book))return next;}
 return items.find(s=>!storyFinished(s,journey,book))||null;
}
