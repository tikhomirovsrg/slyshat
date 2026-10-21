export type StoryReadingState={key:string;revealed:boolean;translation:boolean;choiceTexts:number[]};

export const storyReadingKey=(storyId:string,nodeId:string)=>JSON.stringify([storyId,nodeId]);
export const emptyStoryReading=(key:string):StoryReadingState=>({key,revealed:false,translation:false,choiceTexts:[]});

// A route can change through profile synchronization as well as local clicks.
// Hide the previous scene's reading state during render, before effects run.
export function currentStoryReading(state:StoryReadingState,key:string):StoryReadingState{
 return state.key===key?state:emptyStoryReading(key);
}

export function toggleStoryReading(state:StoryReadingState,key:string,field:'revealed'|'translation'):StoryReadingState{
 const current=currentStoryReading(state,key);
 return {...current,[field]:!current[field]};
}

export function toggleChoiceReading(state:StoryReadingState,key:string,index:number):StoryReadingState{
 const current=currentStoryReading(state,key);
 return {...current,choiceTexts:current.choiceTexts.includes(index)?current.choiceTexts.filter(value=>value!==index):[...current.choiceTexts,index]};
}
