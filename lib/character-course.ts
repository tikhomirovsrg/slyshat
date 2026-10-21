import {getDb} from './db';
import {characterSources} from './character-cast.mjs';
import {loadCharacterAudio} from './character-audio.mjs';
import type {ComicActor, ComicBoard} from './comic-types';

type Member={actorId:string;name:string;sourceVoice:string;voiceProfileId:string};
type Assignment={cast:[Member,Member];playerActorId:string};
type Release={releaseId:string;actors:Record<string,Omit<ComicActor,'name'|'voiceProfileId'|'sourceVoice'|'voice'>>;voiceProfiles:Record<string,{voice:string}>;stories:Record<string,Assignment>};
let installed:{release:Release;checksum:string;audioSources:ReturnType<typeof characterSources>}|undefined;
let audio:any|undefined;

export function characterCourse(){
  if(!installed){
    const db=getDb(),row=db.prepare('SELECT checksum,metadata_json FROM character_cast_releases WHERE id=?').get('character-cast-v1');
    if(!row)throw Error('Character cast is not installed');
    const stories=Object.fromEntries(db.prepare('SELECT story_id,data_json FROM story_character_cast').all().map(r=>[String(r.story_id),JSON.parse(String(r.data_json))]));
    installed={release:{...JSON.parse(String(row.metadata_json)),stories},checksum:String(row.checksum),audioSources:characterSources(db)};
  }
  return installed;
}

export function characterRecordings(){
  if(audio===undefined){const {release,checksum,audioSources}=characterCourse();audio=loadCharacterAudio(release,audioSources,checksum);}
  return audio;
}

export function characterBoard(board:ComicBoard,storyId:string,ready:boolean):ComicBoard{
  const {release}=characterCourse(),assignment=release.stories[storyId];
  if(!assignment)throw Error('Character cast does not cover story: '+storyId);
  const actors=assignment.cast.map(member=>({
    ...release.actors[member.actorId],id:member.actorId,name:member.name,
    voiceProfileId:member.voiceProfileId,sourceVoice:member.sourceVoice,
    voice:ready?release.voiceProfiles[member.voiceProfileId].voice:member.sourceVoice
  })) as [ComicActor,ComicActor];
  return {...board,actors,playerActorId:assignment.playerActorId,castReleaseId:release.releaseId};
}
