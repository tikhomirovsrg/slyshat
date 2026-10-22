export type AuthoredExerciseQuestion={nodeId:string;clipId:string;sourceText:string;prompt:string;options:string[];answer:number;explanation:string;anchor?:string};
export type AuthoredStoryExercises={opening:AuthoredExerciseQuestion;phrase:AuthoredExerciseQuestion;branches:Record<string,AuthoredExerciseQuestion>};
export type StoryExerciseSource={
 id:string;
 language?:string;
 start:string;
 authoredExercises?:AuthoredStoryExercises;
 nodes:Record<string,{
  clips:{id:string;text:string;ru:string}[];
  choices:{text:string;label:string;next:string}[];
  outcome?:{title:string;body:string}|null;
 }>;
};
export type StoryExerciseQuestion={
 id:string;
 type:'choice'|'sequence';
 skill:'comprehension'|'phrase'|'sequence';
 prompt:string;
 options:{id:string;text:string}[];
 answerIds:string[];
 explanation:string;
 evidence:{nodeId:string;clipId:string}[];
};
export type StoryExerciseSet={
 version:1|2;
 releaseId:'story-exercises-v1'|'story-exercises-v2';
 storyId:string;
 routeKey:string;
 questions:StoryExerciseQuestion[];
};
export const STORY_EXERCISES_RELEASE_ID:'story-exercises-v1';
export const AUTHORED_EXERCISES_RELEASE_ID:'story-exercises-v2';
export function buildStoryExercises(story:StoryExerciseSource,path:number[]):StoryExerciseSet|null;
export function gradeStoryExercise(question:StoryExerciseQuestion,answerIds:string[]):boolean;
