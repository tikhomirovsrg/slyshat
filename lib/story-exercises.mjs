import bank from '../content/story-exercises/bank-v1.json' with {type:'json'};

export const STORY_EXERCISES_RELEASE_ID='story-exercises-v1';

// This module is shared by the browser and result validation. Never read media,
// dates, randomness, profiles or unseen branches when building an exercise set.
const normalise=text=>text.toLocaleLowerCase('ru').replace(/[\s\p{P}\p{S}]+/gu,' ').trim();
const evidence=entry=>({nodeId:entry.nodeId,clipId:entry.clip.id});

function hash(text){
 let result=2166136261;
 for(let i=0;i<text.length;i++){result^=text.charCodeAt(i);result=Math.imul(result,16777619);}
 return result>>>0;
}

function shuffled(values,seed){
 const result=[...values];let state=hash(seed)||1;
 for(let i=result.length-1;i>0;i--){
  state^=state<<13;state^=state>>>17;state^=state<<5;
  const j=(state>>>0)%(i+1);[result[i],result[j]]=[result[j],result[i]];
 }
 return result;
}

function completedRoute(story,path){
 if(!story||typeof story.id!=='string'||!story.id||!story.nodes||!Array.isArray(path)||path.length>40||typeof story.start!=='string')return null;
 const route=[story.start];let nodeId=story.start;
 for(const index of path){
  if(!Number.isInteger(index)||index<0||!Object.hasOwn(story.nodes,nodeId))return null;
  const choices=story.nodes[nodeId]?.choices;
  if(!Array.isArray(choices)||index>=choices.length)return null;
  const next=choices[index]?.next;
  if(typeof next!=='string'||!Object.hasOwn(story.nodes,next)||route.includes(next))return null;
  nodeId=next;route.push(next);
 }
 if(!Object.hasOwn(story.nodes,nodeId)||!Array.isArray(story.nodes[nodeId]?.choices)||story.nodes[nodeId].choices.length)return null;
 return route;
}

function choiceQuestion(id,skill,prompt,texts,answerIndex,explanation,refs,seed){
 if(texts.length<3||new Set(texts.map(normalise)).size!==texts.length)return null;
 const choices=shuffled(texts.map((text,index)=>({text,correct:index===answerIndex})),`${seed}:${id}`);
 return {id,type:'choice',skill,prompt,
  options:choices.map((item,index)=>({id:`o${index}`,text:item.text})),
  answerIds:[`o${choices.findIndex(item=>item.correct)}`],explanation,evidence:refs};
}

function bankQuestion(id,skill,definition,source,seed){
 if(!definition||!Array.isArray(definition.options)||!Number.isInteger(definition.answer))return null;
 return choiceQuestion(id,skill,definition.prompt,definition.options,definition.answer,definition.explanation,[evidence(source)],seed);
}

function routeDetail(entries,seed){
 // Prefer the reaction to the first actual decision, rather than a generic
 // farewell shared by several endings. This makes the task branch-specific.
 const branch=entries.filter(entry=>entry.nodeIndex>0);
 const preferred=[...branch.filter(entry=>entry.nodeIndex===1&&entry.clip.ru.length>=45).reverse(),...branch.filter(entry=>entry.clip.ru.length>=45).reverse(),...branch.slice().reverse()];
 for(const target of preferred){
  const distinct=new Map();
  for(const entry of entries){
   const key=normalise(entry.clip.ru);
   if(key!==normalise(target.clip.ru)&&!distinct.has(key))distinct.set(key,entry);
  }
  if(distinct.size<2)continue;
  const alternatives=shuffled([...distinct.values()],`${seed}:detail:${target.nodeId}`).slice(0,2);
  return choiceQuestion('route-detail','comprehension',
   'Прослушай реплику из выбранной ветки. Какое описание точнее передаёт всю её мысль?',
   [target.clip.ru,...alternatives.map(entry=>entry.clip.ru)],0,
   `В этой реплике сказано: ${target.clip.ru} Другие варианты передают иные реплики твоего маршрута.`,
   [evidence(target)],seed);
 }
 return null;
}

function routeSequence(entries,route,seed){
 // One spoken excerpt from each of three different visited frames. We test the
 // order of speech, not the chronology of past events mentioned by a speaker.
 const used=new Set(),perNode=[];
 for(const nodeId of route){
  const candidates=entries.filter(entry=>entry.nodeId===nodeId).reverse();
  const selected=candidates.find(entry=>!used.has(normalise(entry.clip.ru)));
  if(selected){used.add(normalise(selected.clip.ru));perNode.push(selected);}
 }
 if(perNode.length<3)return null;
 const selected=[perNode[0],perNode[Math.floor((perNode.length-1)/2)],perNode.at(-1)];
 let order=shuffled([0,1,2],`${seed}:sequence`);
 if(order.every((item,index)=>item===index))order=[1,2,0];
 const options=order.map((index,position)=>({id:`o${position}`,text:selected[index].clip.ru}));
 return {id:'route-sequence',type:'sequence',skill:'sequence',
  prompt:'Расположи реплики в том порядке, в котором они прозвучали в твоём маршруте. Ниже — их смысл по-русски.',
  options,answerIds:selected.map((_,index)=>`o${order.indexOf(index)}`),
  explanation:`В пройденной истории реплики звучали так: ${selected.map((entry,index)=>`${index+1}. ${entry.clip.ru}`).join(' ')}`,
  evidence:selected.map(evidence)};
}

/** Four source-grounded exercises for a complete, valid route; null otherwise. */
export function buildStoryExercises(story,path){
 const route=completedRoute(story,path);if(!route)return null;
 const routeKey=`${STORY_EXERCISES_RELEASE_ID}:${story.id}:${path.join('.')}`;
 const entries=[];
 for(let nodeIndex=0;nodeIndex<route.length;nodeIndex++){
  const nodeId=route[nodeIndex],clips=story.nodes[nodeId]?.clips;
  if(!Array.isArray(clips))return null;
  for(const clip of clips){
   if(!clip||typeof clip.id!=='string'||!clip.id||typeof clip.text!=='string'||!clip.text.trim()||typeof clip.ru!=='string'||!clip.ru.trim())return null;
   entries.push({nodeId,nodeIndex,clip});
  }
 }
 const source=entries.find(entry=>entry.nodeIndex===0&&Object.hasOwn(bank.entries,entry.clip.id));
 if(!source)return null;
 const definition=bank.entries[source.clip.id];
 // Do not silently reuse an authored answer after its supporting text changes.
 if(definition.sourceText!==source.clip.text||!source.clip.text.includes(definition.phrase.anchor))return null;
 const fact=bankQuestion('opening-fact','comprehension',definition.fact,source,routeKey);
 const detail=routeDetail(entries,routeKey);
 const phrase=bankQuestion('phrase-meaning','phrase',definition.phrase,source,routeKey);
 const sequence=routeSequence(entries,route,routeKey);
 if(!fact||!detail||!phrase||!sequence)return null;
 return {version:1,releaseId:STORY_EXERCISES_RELEASE_ID,storyId:story.id,routeKey,questions:[fact,detail,phrase,sequence]};
}

/** Strict comparison also rejects missing, duplicate, extra and unknown IDs. */
export function gradeStoryExercise(question,answerIds){
 if(!question||!Array.isArray(question.options)||!Array.isArray(question.answerIds)||!Array.isArray(answerIds))return false;
 if(!['choice','sequence'].includes(question.type)||!answerIds.length||answerIds.length!==question.answerIds.length||new Set(answerIds).size!==answerIds.length)return false;
 if(answerIds.some(id=>typeof id!=='string'||!question.options.some(option=>option.id===id)))return false;
 if(question.type==='choice'&&answerIds.length!==1)return false;
 if(question.type==='sequence'&&answerIds.length!==question.options.length)return false;
 return answerIds.every((id,index)=>id===question.answerIds[index]);
}
