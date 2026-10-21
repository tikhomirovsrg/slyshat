export type ComicLocation='cafe'|'station'|'square'|'home'|'office'|'park'|'gallery'|'market';
export type ComicProp='phone'|'clock'|'map'|'cup'|'book'|'ticket'|'camera'|'parcel'|'tools'|'umbrella'|'laptop'|'conversation';
export type ComicMood='neutral'|'speaking'|'thinking'|'pleased';
export type ComicPanel={location:ComicLocation;shot:'wide'|'left'|'right'|'detail';mood:ComicMood;prop:ComicProp;caption:string;clue:{title:string;body:string};beatAt:number};
export type ComicBoard={releaseId:string;hook:string;series:string;cover:ComicLocation;featured:boolean;cast:[string,string];scenes:Record<string,ComicPanel>};
export type ComicCard=Pick<ComicBoard,'hook'|'series'|'cover'|'featured'>;
