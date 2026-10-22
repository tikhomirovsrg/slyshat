import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {EXPANSION_PLAN_PARTS,EXPANSION_TARGETS} from '../../lib/story-expansion.mjs';

const partial=process.argv.includes('--partial'),plans=[];
for(const part of EXPANSION_PLAN_PARTS){
 const path=resolve(`content/story-expansion-plans/${part}.json`);
 if(!existsSync(path)){if(!partial)throw Error('Missing plan '+part);continue;}
 const rows=JSON.parse(readFileSync(path));if(!Array.isArray(rows))throw Error('Invalid plan array');plans.push(...rows);
}
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
const ids=new Set(),fingerprints=new Map(),sources=new Map(),counts={en:{},it:{}};
for(const row of plans){
 for(const key of ['id','language','level','titleRU','sourceTitle','sourceAuthor','sourceUrl','sourceStatus','sourcePlotRU','adaptationPremiseRU','conflictRU','choiceARU','choiceBRU','outcomeARU','outcomeBRU','humorRU','levelRationaleRU','plotFingerprint','genre'])if(typeof row[key]!=='string'||!row[key].trim())throw Error('Missing plan field '+row.id+' '+key);
 if(ids.has(row.id)||!EXPANSION_TARGETS[row.language]?.[row.level]||!row.id.startsWith(`new-${row.language}-${row.level.toLowerCase()}-`))throw Error('Invalid plan identity '+row.id);ids.add(row.id);
 for(const [map,key,label] of [[fingerprints,normalize(row.plotFingerprint),'plot fingerprint'],[sources,normalize(row.sourceAuthor+' '+row.sourceTitle),'source plot']]){
  if(map.has(key))throw Error('Repeated '+label+': '+map.get(key)+' / '+row.id);map.set(key,row.id);
 }
 const url=new URL(row.sourceUrl);if(url.protocol!=='https:')throw Error('Source needs HTTPS');
 counts[row.language][row.level]=(counts[row.language][row.level]||0)+1;
}
if(!partial)for(const [language,levels] of Object.entries(EXPANSION_TARGETS))for(const [level,count] of Object.entries(levels))if(counts[language][level]!==count)throw Error('Incomplete plan '+language+' '+level);

// A lexical review queue, not a semantic duplicate verdict. Inspect the actual
// conflict, event sequence and ending before accepting or rejecting a pair.
const stop=new Set('который которая которые каждого теперь новый новые снова такой также чтобы после перед вместе другой друга другой другая своего через может нужно можно решает вместо только затем получает герой герои история происходит'.split(' ').map(word=>word.slice(0,6)));
const tokens=text=>new Set((normalize(text).match(/[а-яёa-z]{4,}/g)||[]).map(word=>word.slice(0,6)).filter(word=>!stop.has(word)));
const documents=plans.map(row=>({id:row.id,kind:'candidate',text:[row.adaptationPremiseRU,row.conflictRU,row.outcomeARU,row.outcomeBRU].join(' ')}));
const old=JSON.parse(readFileSync('content/story-course/course-v1.json')),keep=new Set(JSON.parse(readFileSync('content/story-curation/v1.json')).stories.map(row=>row.id));
for(const story of old.stories.filter(story=>keep.has(story.id)))documents.push({id:story.id,kind:'retained',text:[story.title,story.summary,story.context,...Object.values(story.nodes).map(node=>node.outcome?.body||'')].join(' ')});
const bags=documents.map(item=>tokens(item.text)),frequency=new Map();for(const bag of bags)for(const word of bag)frequency.set(word,(frequency.get(word)||0)+1);
const weight=word=>Math.log(1+documents.length/(frequency.get(word)||1));
const norms=bags.map(bag=>Math.sqrt([...bag].reduce((sum,word)=>sum+weight(word)**2,0))),pairs=[];
for(let a=0;a<plans.length;a++)for(let b=a+1;b<documents.length;b++){
 const shared=[...bags[a]].filter(word=>bags[b].has(word)),score=shared.reduce((sum,word)=>sum+weight(word)**2,0)/(norms[a]*norms[b]||1);
 if(score>=.12)pairs.push({a:documents[a].id,b:documents[b].id,score:Number(score.toFixed(3)),shared});
}
pairs.sort((a,b)=>b.score-a.score);
const report={candidateCount:plans.length,counts,exactDuplicateIds:0,exactDuplicateFingerprints:0,exactSourceReuses:0,notice:'Similarity only queues manual review; it cannot certify distinct plots.',reviewPairs:pairs};
const outputIndex=process.argv.indexOf('--report');if(outputIndex>=0)writeFileSync(process.argv[outputIndex+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,reviewPairs:pairs.slice(0,20)}));
