import english from '../content/story-presentation/en-v1.json';
import italian from '../content/story-presentation/it-v1.json';
import type {StoryCard} from './story-course-types';
import type {ComicBoard} from './comic-types';

type Text = {title:string;topic:string;summary:string;context:string;hook:string};
type Release = {
 formatVersion:number;releaseId:string;language:string;courseSha256:string;
 legacy:Record<string,Text>;topics:Record<string,Omit<Text,'topic'>>;
 problems:Record<string,{title:string;hook:string}>;series:Record<string,string>;
};
const releases:Record<string,Release>={en:english,it:italian};

// Presentation is layered over the immutable course. IDs, graphs and audio
// source hashes remain unchanged, including on already installed databases.
export function storyPresentation(story:Pick<StoryCard,'id'|'language'|'legacy'>,board:Pick<ComicBoard,'series'|'releaseId'>,courseSha256:string):Text&{series:string}{
 const release=releases[story.language];
 if(!release||release.formatVersion!==1||release.releaseId!=='story-presentation-v1'||release.language!==story.language||release.courseSha256!==courseSha256||board.releaseId!=='comic-v1')throw Error('Story presentation version mismatch');
 const series=release.series[board.series];
 if(!series)throw Error('Missing translated story series: '+story.id);
 if(story.legacy){
  const text=release.legacy[story.id];
  if(!text)throw Error('Missing translated story: '+story.id);
  return {...text,series};
 }
 const parts=story.id.split('-'),topic=release.topics[parts.slice(3,-1).join('-')],problem=release.problems[parts.at(-1)!];
 if(!topic||!problem)throw Error('Missing translated story variant: '+story.id);
 return {title:topic.title+' · '+problem.title,topic:topic.title,summary:topic.summary,context:topic.context,hook:topic.hook+' '+problem.hook,series};
}
