const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {storyExerciseStats,storiesToReview}=require('../lib/story-review.ts');
const {STORY_EXERCISES_RELEASE_ID:release}=require('../lib/story-exercises.mjs');
const ids=['opening-fact','route-detail','phrase-meaning','route-sequence'];
const at='2026-10-20T12:00:00.000Z',day=24*60*60*1000;
const story=(id,position=1)=>({id,position,language:'en',level:'A1',title:id,topic:'Test',summary:'Test',art:'coffee',legacy:false});
function progress(id){return {path:[0,1],heard:['start','a','end'],assisted:[],finishedAt:at,completedAt:at,updatedAt:at,exercises:{version:release,routeKey:`${release}:${id}:0.1`,answers:Object.fromEntries(ids.map((id,index)=>[id,{answerIds:index===3?['o0','o1','o2']:['o0'],correct:index!==1,assisted:index>=2,checkedAt:at}])),assisted:true,replayed:true,updatedAt:at,completedAt:at}};}
const journey=stories=>({active:{en:Object.keys(stories)[0]},stories});

test('Story statistics count the current route and preserve assistance at each answer',()=>{
 const p=progress('one'),before=structuredClone(p),stats=storyExerciseStats([story('one')],journey({one:p,two:progress('two')}));
 assert.deepEqual(stats,{independent:{correct:1,total:2},assisted:{correct:2,total:2},completed:1,started:1});
 assert.deepEqual(p,before); // No profile mutation or fabricated progress.
});

test('Unfinished, stale-route and malformed results do not count as completed learning',()=>{
 const unfinished={...progress('unfinished'),finishedAt:null};
 const stale=progress('stale');stale.exercises.routeKey=`${release}:stale:1.0`;
 const invalid=progress('invalid');invalid.exercises.answers.unknown={answerIds:['o0'],correct:true,assisted:false,checkedAt:at};
 const futureVersion=progress('future');futureVersion.exercises.version='story-exercises-future';
 const rows={unfinished,stale,invalid,future:futureVersion};
 assert.deepEqual(storyExerciseStats(Object.keys(rows).map(story),journey(rows)),{independent:{correct:0,total:0},assisted:{correct:0,total:0},completed:0,started:0});
});

test('Review is due after a day of actual completed practice, not ordinary story visits',()=>{
 const p=progress('one'),items=[story('one')],rows=journey({one:p}),now=Date.parse(at)+day;
 assert.deepEqual(storiesToReview(items,rows,now-1),[]);
 assert.equal(storiesToReview(items,rows,now)[0].kind,'review');
 p.updatedAt=new Date(now).toISOString();assert.equal(storiesToReview(items,rows,now).length,1);
 p.exercises.answers['route-sequence'].checkedAt=new Date(now).toISOString();
 assert.deepEqual(storiesToReview(items,rows,now),[]);
 assert.equal(storiesToReview(items,rows,now+day)[0].lastPracticeAt,new Date(now).toISOString());
});

test('Review queue prioritizes unfinished checks, excludes restarted routes and honours its limit',()=>{
 const old=progress('old'),unfinished={...progress('unfinished'),exercises:undefined},restarted={...progress('restarted'),finishedAt:null};
 const recent=progress('recent');recent.finishedAt='2026-10-21T11:00:00.000Z';for(const answer of Object.values(recent.exercises.answers))answer.checkedAt=recent.finishedAt;
 const rows=journey({old,unfinished,restarted,recent}),items=['old','unfinished','restarted','recent'].map(story),now=Date.parse(at)+day;
 assert.deepEqual(storiesToReview(items,rows,now).map(item=>[item.story.id,item.kind]),[['unfinished','unfinished'],['old','review']]);
 assert.equal(storiesToReview(items,rows,now,1).length,1);assert.equal(storiesToReview(items,rows,now,0).length,0);
});
