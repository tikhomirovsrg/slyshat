import type {Journey,JourneyProgress,StoryCard,StoryExerciseAttempt} from './story-course-types';
import {STORY_EXERCISES_RELEASE_ID,AUTHORED_EXERCISES_RELEASE_ID} from './story-exercises.mjs';
import {validateExerciseAttemptShape} from './story-exercise-state';
import {reviewIntervals} from '../app/study-types';

const questionIds=['opening-fact','route-detail','phrase-meaning','route-sequence'];
const validTime=(value:string|undefined|null)=>value?Date.parse(value):NaN;

// The server validates answer correctness against the source story on save.
// Only results belonging to the currently finished route contribute here.
function currentAttempt(storyId:string,progress:JourneyProgress|undefined):StoryExerciseAttempt|null{
 if(!progress?.finishedAt||!Number.isFinite(validTime(progress.finishedAt))||!progress.exercises)return null;
 try{
  const attempt=validateExerciseAttemptShape(progress.exercises);
  const release=storyId.startsWith('new-')?AUTHORED_EXERCISES_RELEASE_ID:STORY_EXERCISES_RELEASE_ID;
  if(attempt.version!==release||attempt.routeKey!==`${release}:${storyId}:${progress.path.join('.')}`||Object.keys(attempt.answers).some(id=>!questionIds.includes(id)))return null;
  return attempt;
 }catch{return null;}
}

export function storyExerciseStats(items:StoryCard[],journey?:Journey){
 const result={independent:{correct:0,total:0},assisted:{correct:0,total:0},completed:0,started:0};
 for(const story of items){
  const attempt=currentAttempt(story.id,journey?.stories[story.id]);if(!attempt)continue;
  const answers=Object.values(attempt.answers);if(answers.length)result.started++;
  if(questionIds.every(id=>!!attempt.answers[id]))result.completed++;
  for(const answer of answers){
   // Assistance is recorded when each answer is checked. Later help must not
   // retrospectively reclassify an earlier independent answer.
   const group=answer.assisted?result.assisted:result.independent;
   group.total++;if(answer.correct)group.correct++;
  }
 }
 return result;
}

export type StoryReview={story:StoryCard;kind:'unfinished'|'review';lastPracticeAt:string};

export function storiesToReview(items:StoryCard[],journey:Journey|undefined,now=Date.now(),limit=3):StoryReview[]{
 const result:StoryReview[]=[];
 for(const story of items){
  const progress=journey?.stories[story.id],finished=validTime(progress?.finishedAt);
  if(!progress?.finishedAt||!Number.isFinite(finished)||finished>now)continue;
  const attempt=currentAttempt(story.id,progress),complete=!!attempt&&questionIds.every(id=>!!attempt.answers[id]);
  const last=Math.max(finished,...Object.values(attempt?.answers||{}).map(answer=>validTime(answer.checkedAt)));
  if(last>now)continue;
  if(!complete){result.push({story,kind:'unfinished',lastPracticeAt:new Date(last).toISOString()});continue;}
  // Start with the same first interval as vocabulary review. No adaptive
  // schedule is inferred from the one retained exercise attempt.
  if(now-last>=reviewIntervals[0]*24*60*60*1000)result.push({story,kind:'review',lastPracticeAt:new Date(last).toISOString()});
 }
 return result.sort((a,b)=>(a.kind==='unfinished'?0:1)-(b.kind==='unfinished'?0:1)||Date.parse(a.lastPracticeAt)-Date.parse(b.lastPracticeAt)||a.story.position-b.story.position).slice(0,Math.max(0,limit));
}
