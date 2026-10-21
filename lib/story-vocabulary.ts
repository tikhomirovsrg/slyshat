import vocabulary from '../content/story-vocabulary/v1.json';
import type {StoryCard} from './story-course-types';

export type StoryVocabularyEntry={term:string;ru:string};
type Release={
 formatVersion:number;releaseId:string;courseSha256:string;librarySha256:string;
 legacy:Record<string,{language:string;level:string;entries:StoryVocabularyEntry[]}>;
 topics:Record<string,Record<string,StoryVocabularyEntry>>;
 problems:Record<string,Record<string,Record<string,StoryVocabularyEntry[]>>>;
};
const release:Release=vocabulary;

// These are short listening cues, not a transcript or answers to the story.
// Shared course variants use one topic cue and two level-specific situation
// cues. The immutable course and its audio references remain untouched.
export function storyVocabulary(story:Pick<StoryCard,'id'|'language'|'level'|'legacy'>,courseSha256:string):StoryVocabularyEntry[]{
 if(release.formatVersion!==1||release.releaseId!=='story-vocabulary-v1'||release.courseSha256!==courseSha256)throw Error('Story vocabulary version mismatch');
 let entries:StoryVocabularyEntry[];
 if(story.legacy){
  const item=release.legacy[story.id];
  if(!item||item.language!==story.language||item.level!==story.level)throw Error('Missing story vocabulary: '+story.id);
  entries=item.entries;
 }else{
  const parts=story.id.split('-');
  if(parts[0]!=='story'||parts[1]!==story.language||parts[2]!==story.level.toLowerCase())throw Error('Story vocabulary identity mismatch');
  const topic=release.topics[story.language]?.[parts.slice(3,-1).join('-')];
  const problem=release.problems[story.language]?.[story.level]?.[parts.at(-1)!];
  if(!topic||!problem)throw Error('Missing story vocabulary: '+story.id);
  entries=[topic,...problem];
 }
 if(entries.length!==3||entries.some(item=>!item.term.trim()||!item.ru.trim()))throw Error('Incomplete story vocabulary: '+story.id);
 return entries.map(({term,ru})=>({term,ru}));
}
