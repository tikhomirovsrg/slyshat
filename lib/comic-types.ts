export type ComicLocation='cafe'|'station'|'square'|'home'|'office'|'park'|'gallery'|'market';
export type ComicProp='phone'|'clock'|'map'|'cup'|'book'|'ticket'|'camera'|'parcel'|'tools'|'umbrella'|'laptop'|'conversation';
export type ComicMood='neutral'|'speaking'|'thinking'|'pleased';
export type ComicPanel={location:ComicLocation;shot:'wide'|'left'|'right'|'detail';mood:ComicMood;prop:ComicProp;caption:string;clue:{title:string;body:string};beatAt:number};
export type ComicActor={id:string;name:string;label:string;species:string;wardrobe:string;personality:string;artBase:string;artLayout?:'separate'|'sheet-2x2';voiceProfileId:string;sourceVoice:string;voice:string};
export type ComicBoard={releaseId:string;hook:string;series:string;cover:ComicLocation;featured:boolean;cast:[string,string];scenes:Record<string,ComicPanel>;actors?:[ComicActor,ComicActor];playerActorId?:string;castReleaseId?:string};
export type ComicCard=Pick<ComicBoard,'hook'|'series'|'cover'|'featured'>&{coverActor?:Pick<ComicActor,'artBase'|'artLayout'|'label'>};
