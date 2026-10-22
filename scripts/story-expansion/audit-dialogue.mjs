import {readFileSync,writeFileSync} from 'node:fs';
import {readExpansion} from '../../lib/story-expansion.mjs';

const partial=process.argv.includes('--partial'),release=readExpansion(process.cwd(),{complete:!partial});
const old=JSON.parse(readFileSync('content/story-course/course-v1.json')),library=JSON.parse(readFileSync('content/audio-library/series-v1.json'));
const keep=new Set(JSON.parse(readFileSync('content/story-curation/v1.json')).stories.map(row=>row.id));
const documents=release.stories.map(story=>({id:story.id,language:story.language,kind:'new',lines:Object.values(story.nodes).flatMap(node=>node.lines.map(line=>line.text)),outcomes:Object.values(story.nodes).flatMap(node=>node.outcome?[node.outcome.body]:[])}));
for(const story of old.stories.filter(story=>keep.has(story.id)))documents.push({id:story.id,language:story.language,kind:'retained',lines:Object.values(story.nodes).flatMap(node=>node.clips.map(ref=>(ref.set==='course'?old:library).segments[ref.id].text)),outcomes:Object.values(story.nodes).flatMap(node=>node.outcome?[node.outcome.body]:[])});
const normalize=text=>text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim();
const exact=[],seen=new Map();
for(const story of documents)for(const text of [...story.lines,...story.outcomes]){
 const normalized=normalize(text);if(normalized.length<80)continue;
 const key=story.language+':'+normalized,previous=seen.get(key);
 if(previous&&previous.id!==story.id&&(previous.kind==='new'||story.kind==='new'))exact.push({a:previous.id,b:story.id,text});
 else seen.set(key,{id:story.id,kind:story.kind});
}
const shingle=text=>{const words=normalize(text).split(' '),set=new Set();for(let i=0;i<words.length-2;i++)set.add(words.slice(i,i+3).join(' '));return set;};
const bags=documents.map(story=>shingle(story.lines.join(' '))),pairs=[];
for(let a=0;a<release.stories.length;a++)for(let b=a+1;b<documents.length;b++){
 if(documents[a].language!==documents[b].language)continue;
 const intersection=[...bags[a]].filter(value=>bags[b].has(value)).length,score=intersection/(bags[a].size+bags[b].size-intersection||1);
 if(score>=.025)pairs.push({a:documents[a].id,b:documents[b].id,sharedTrigrams:intersection,similarity:Number(score.toFixed(4))});
}
pairs.sort((a,b)=>b.similarity-a.similarity);
const report={sourceSha256:release.checksum,newStories:release.stories.length,retainedStories:documents.length-release.stories.length,exactLongRepeatedPassages:exact,similarityReview:pairs,notice:'Shared words cannot determine whether plots repeat. Review events and outcomes separately.'};
const outputIndex=process.argv.indexOf('--report');if(outputIndex>=0)writeFileSync(process.argv[outputIndex+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,similarityReview:pairs.slice(0,30)}));
if(exact.length)process.exitCode=1;
