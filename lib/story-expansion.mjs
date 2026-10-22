import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export const EXPANSION_RELEASE='story-expansion-v1';
export const EXPANSION_PLAN_PARTS=['en-lower','en-middle','it-lower','it-middle','advanced'];
export const EXPANSION_PARTS=['en-lower','en-middle','it-lower','it-middle','advanced','advanced-it-a','advanced-it-b','it-b2-finish-a','it-b2-finish-b','it-c1-finish-a','it-c1-finish-b'];
export const EXPANSION_TARGETS={en:{A1:30,A2:19,B1:21,B2:25,C1:28},it:{A1:29,A2:19,B1:22,B2:25,C1:28}};
const levels=['A1','A2','B1','B2','C1'];
const actors=['traveler','cartographer','host','maker','curator','conductor'];
const locations=['cafe','station','square','home','office','park','gallery','market'];
const props=['phone','clock','map','cup','book','ticket','camera','parcel','tools','umbrella','laptop','conversation'];
const normal=text=>text.toLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireText=(value,label)=>{if(typeof value!=='string'||!value.trim())throw Error('Missing expansion '+label);};
const requireObject=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid expansion '+label);};
export const expansionClipId=(storyId,nodeId,index)=>`${storyId}:${nodeId}:line:${index}`;
export const expansionChoiceId=(storyId,nodeId,index)=>`${storyId}:${nodeId}:choice:${index}`;

export function expansionRoutes(story){
 const routes=[];
 function visit(nodeId,path,seen){
  if(seen.includes(nodeId))throw Error('Cyclic expansion route: '+story.id);
  const node=story.nodes[nodeId];if(!node)throw Error('Dangling expansion route: '+story.id);
  const route=[...seen,nodeId];
  if(!node.choices.length){routes.push({path,nodes:route});return;}
  node.choices.forEach((choice,index)=>visit(choice.next,[...path,index],route));
 }
 visit(story.start,[],[]);return routes;
}

function validateQuestion(question,story,nodeId,phrase=false){
 requireObject(question,`${story.id} question`);
 if(question.nodeId!==nodeId||!Number.isInteger(question.line)||question.line<0)throw Error('Question uses another scene: '+story.id);
 const line=story.nodes[nodeId]?.lines[question.line];if(!line)throw Error('Missing exercise evidence: '+story.id);
 for(const key of ['prompt','explanation'])requireText(question[key],`${story.id} exercise ${key}`);
 if(!Array.isArray(question.options)||question.options.length!==3||!Number.isInteger(question.answer)||question.answer<0||question.answer>2)throw Error('Invalid expansion answers: '+story.id);
 question.options.forEach(option=>requireText(option,`${story.id} option`));
 if(new Set(question.options.map(normal)).size!==3)throw Error('Repeated expansion options: '+story.id);
 if(phrase){requireText(question.anchor,'phrase anchor');if(!line.text.includes(question.anchor))throw Error('Phrase absent from evidence: '+story.id);}
}

/** Structural checks do not certify CEFR or replace editorial plot review. */
export function validateExpansion(stories,{complete=true}={}){
 if(!Array.isArray(stories))throw Error('Invalid expansion stories');
 const seen=new Set(),fingerprints=new Set(),sources=new Set(),texts=new Set(),counts={en:{},it:{}};
 for(const story of stories){
  requireObject(story,'story');
  if(!['en','it'].includes(story.language)||!levels.includes(story.level)||!new RegExp(`^new-${story.language}-${story.level.toLowerCase()}-[a-z0-9-]+$`).test(story.id)||story.id.length>100||seen.has(story.id))throw Error('Invalid/duplicate expansion identity: '+story.id);
  seen.add(story.id);counts[story.language][story.level]=(counts[story.language][story.level]||0)+1;
  for(const key of ['title','topic','summary','context','hook','genre','plotFingerprint'])requireText(story[key],`${story.id} ${key}`);
  for(const key of ['title','topic','summary','context','hook'])if(/\p{Script=Cyrillic}/u.test(story[key]))throw Error('Story presentation must use the lesson language: '+story.id);
  const fingerprint=normal(story.plotFingerprint);if(fingerprints.has(fingerprint))throw Error('Repeated expansion plot: '+story.id);fingerprints.add(fingerprint);
  requireObject(story.source,'source');
  for(const key of ['title','author','url','status','adaptation'])requireText(story.source[key],`${story.id} source ${key}`);
  const url=new URL(story.source.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid expansion source URL: '+story.id);
  const sourceKey=normal(story.source.author+' '+story.source.title);if(sources.has(sourceKey))throw Error('Source plot reused: '+story.id);sources.add(sourceKey);
  requireObject(story.pedagogy,'pedagogy');
  for(const key of ['rationaleRU','listeningFocusRU'])requireText(story.pedagogy[key],`${story.id} ${key}`);
  if(!Array.isArray(story.pedagogy.grammar)||!story.pedagogy.grammar.length)throw Error('Missing grammar review: '+story.id);
  if(!Array.isArray(story.cast)||story.cast.length!==2||new Set(story.cast.map(member=>member.actorId)).size!==2)throw Error('Invalid expansion cast: '+story.id);
  for(const member of story.cast){if(!actors.includes(member.actorId))throw Error('Unknown expansion actor');requireText(member.name,'actor name');requireText(member.roleRU,'actor role');}
  requireObject(story.nodes,'nodes');
  if(Object.keys(story.nodes).length<5||Object.keys(story.nodes).length>9||story.start!=='start'||story.nodes.start?.choices?.length!==2)throw Error('Invalid expansion graph: '+story.id);
  const speakers=new Set();
  for(const [id,node] of Object.entries(story.nodes)){
   if(!/^[a-z][a-z0-9-]{0,30}$/.test(id)||!Array.isArray(node.lines)||!node.lines.length||node.lines.length>3||!Array.isArray(node.choices)||node.choices.length>2)throw Error('Invalid expansion scene: '+story.id);
   for(const line of node.lines){if(![0,1].includes(line.speaker))throw Error('Invalid line speaker');speakers.add(line.speaker);requireText(line.text,'line text');requireText(line.ru,'line translation');if(/\p{Script=Cyrillic}/u.test(line.text))throw Error('Cyrillic in spoken expansion text: '+story.id);}
   for(const choice of node.choices){requireText(choice.text,'answer text');requireText(choice.ru,'answer translation');if(/\p{Script=Cyrillic}/u.test(choice.text))throw Error('Cyrillic in spoken expansion choice: '+story.id);if(!Object.hasOwn(story.nodes,choice.next))throw Error('Unknown expansion next scene: '+story.id);}
   if(new Set(node.choices.map(choice=>normal(choice.text))).size!==node.choices.length)throw Error('Duplicate story choice: '+story.id);
   if(!node.choices.length){requireObject(node.outcome,'ending');requireText(node.outcome.title,'ending title');requireText(node.outcome.body,'ending body');}
   else if(node.outcome)throw Error('Non-terminal expansion outcome: '+story.id);
   requireObject(node.frame,'frame');const frame=node.frame;
   if(!locations.includes(frame.location)||!props.includes(frame.prop)||!['neutral','speaking','thinking','pleased'].includes(frame.mood))throw Error('Invalid expansion scene art: '+story.id);
   requireText(frame.caption,'caption');requireObject(frame.clue,'clue');requireText(frame.clue.title,'clue title');requireText(frame.clue.body,'clue body');
  }
  if(speakers.size!==2)throw Error('Both human characters must speak: '+story.id);
  const routes=expansionRoutes(story),reachable=new Set(routes.flatMap(route=>route.nodes));
  if(reachable.size!==Object.keys(story.nodes).length||routes.some(route=>route.nodes.length<3)||new Set(routes.map(route=>route.nodes.at(-1))).size<2)throw Error('Unreachable or incomplete expansion branches: '+story.id);
  const opening=normal(story.nodes.start.lines.map(line=>line.text).join(' '));
  if(!Array.isArray(story.vocabulary)||story.vocabulary.length!==3||new Set(story.vocabulary.map(entry=>normal(entry.term))).size!==3)throw Error('Expected three vocabulary expressions: '+story.id);
  for(const entry of story.vocabulary){requireText(entry.term,'vocabulary term');requireText(entry.ru,'vocabulary translation');if(!opening.includes(normal(entry.term)))throw Error('Vocabulary absent from opening: '+story.id+' '+entry.term);}
  requireObject(story.exercises,'exercises');
  validateQuestion(story.exercises.opening,story,'start');validateQuestion(story.exercises.phrase,story,'start',true);
  requireObject(story.exercises.branches,'branch exercises');
  for(const route of routes)validateQuestion(story.exercises.branches[route.nodes[1]],story,route.nodes[1]);
  for(const nodeId of Object.keys(story.exercises.branches))if(!routes.some(route=>route.nodes[1]===nodeId))throw Error('Unvisited branch exercise: '+story.id);
  const body=normal(Object.values(story.nodes).flatMap(node=>node.lines.map(line=>line.text)).join(' '));
  if(texts.has(body))throw Error('Duplicate expansion dialogue: '+story.id);texts.add(body);
 }
 if(complete)for(const lang of ['en','it'])for(const level of levels)if((counts[lang][level]||0)!==EXPANSION_TARGETS[lang][level])throw Error(`Incomplete expansion ${lang} ${level}: ${counts[lang][level]||0}/${EXPANSION_TARGETS[lang][level]}`);
 return {stories:stories.length,counts};
}

/** Files stay independent of the immutable v1 SQLite/cast/audio releases. */
export function readExpansion(root=process.cwd(),{complete=true}={}){
 const stories=[],hashes={};
 for(const part of EXPANSION_PARTS){
  const path=resolve(root,`content/story-expansion/v1/${part}.json`);
  if(!existsSync(path)){if(complete)throw Error('Missing expansion partition: '+part);continue;}
  const bytes=readFileSync(path),rows=JSON.parse(bytes);if(!Array.isArray(rows))throw Error('Invalid expansion partition: '+part);
  hashes[part]=sha(bytes);stories.push(...rows);
 }
 const audit=validateExpansion(stories,{complete});
 return {releaseId:EXPANSION_RELEASE,stories,hashes,checksum:sha(JSON.stringify(hashes)),audit};
}

/** Only the current story's authored questions go to the browser. */
export function expansionExerciseSource(story){
 const definition=question=>({...question,clipId:expansionClipId(story.id,question.nodeId,question.line),sourceText:story.nodes[question.nodeId].lines[question.line].text});
 return {id:story.id,language:story.language,start:story.start,
  nodes:Object.fromEntries(Object.entries(story.nodes).map(([id,node])=>[id,{clips:node.lines.map((line,index)=>({id:expansionClipId(story.id,id,index),text:line.text,ru:line.ru})),choices:node.choices.map(choice=>({text:choice.text,label:choice.ru,next:choice.next})),...(node.outcome?{outcome:node.outcome}:{})}])),
  authoredExercises:{opening:definition(story.exercises.opening),phrase:definition(story.exercises.phrase),branches:Object.fromEntries(Object.entries(story.exercises.branches).map(([id,question])=>[id,definition(question)]))}};
}
