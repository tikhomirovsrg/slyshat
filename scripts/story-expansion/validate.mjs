import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {readExpansion,expansionRoutes,expansionExerciseSource,EXPANSION_PLAN_PARTS} from '../../lib/story-expansion.mjs';
import {buildStoryExercises} from '../../lib/story-exercises.mjs';

const partial=process.argv.includes('--partial');
const release=readExpansion(process.cwd(),{complete:!partial});
const plans=new Map();
for(const part of EXPANSION_PLAN_PARTS){const file=`content/story-expansion-plans/${part}.json`;if(existsSync(file))for(const plan of JSON.parse(readFileSync(file)))plans.set(plan.id,plan);}
const wordCount=text=>(text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[]).length;
const metrics=[];
for(const story of release.stories){
 const plan=plans.get(story.id);
 if(!plan||story.plotFingerprint!==plan.plotFingerprint||story.source.url!==plan.sourceUrl||story.source.title!==plan.sourceTitle||story.source.author!==plan.sourceAuthor||story.language!==plan.language||story.level!==plan.level)throw Error('Authored story no longer matches its selected source/plan: '+story.id);
 const source=expansionExerciseSource(story),routes=expansionRoutes(story);
 for(const route of routes){
  const exercises=buildStoryExercises(source,route.path);
  if(exercises?.questions.length!==4||exercises.releaseId!=='story-exercises-v2')throw Error('Missing authored route exercises: '+story.id);
  for(const question of exercises.questions)for(const ref of question.evidence)if(!route.nodes.includes(ref.nodeId))throw Error('Exercise leaks unseen branch: '+story.id);
 }
 metrics.push({id:story.id,language:story.language,level:story.level,source:story.source.url,routes:routes.length,routeWords:routes.map(route=>wordCount(route.nodes.flatMap((id,index)=>[...story.nodes[id].lines.map(line=>line.text),...(index<route.path.length?[story.nodes[id].choices[route.path[index]].text]:[])]).join(' ')))});
}
const report={...release.audit,checksum:release.checksum,metrics};
const outputIndex=process.argv.indexOf('--report');if(outputIndex>=0)writeFileSync(process.argv[outputIndex+1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...release.audit,checksum:release.checksum,routeCount:metrics.reduce((sum,item)=>sum+item.routes,0),complete:!partial}));
