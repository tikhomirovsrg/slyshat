import {createHash} from 'node:crypto';

export const characterHash = value => createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;

// Original speaker identities are explicit data. Never infer a character from
// the gender, prefix or spelling of a synthesis voice name.
export function characterForVoice(cast, sourceVoice) {
  const member = cast.cast.find(actor => actor.sourceVoice === sourceVoice);
  if (!member) throw Error('Character cast has no source speaker: ' + sourceVoice);
  return member;
}

export function characterSources(db) {
  const row = db.prepare('SELECT checksum,metadata_json FROM story_course_releases WHERE id=?').get('story-course-v1');
  const library = db.prepare('SELECT checksum FROM audio_content_releases').all();
  if (!row || library.length !== 1) throw Error('Character source releases are not installed');
  return {
    courseSha256: String(row.checksum), librarySha256: String(library[0].checksum),
    course: {...JSON.parse(String(row.metadata_json)), stories: db.prepare('SELECT data_json FROM story_course_entries ORDER BY language,position').all().map(r => JSON.parse(String(r.data_json)))},
    librarySegments: Object.fromEntries(db.prepare('SELECT id,data_json FROM audio_content_segments').all().map(r => [String(r.id), JSON.parse(String(r.data_json))]))
  };
}

export function validateCharacterCast(release, sources) {
  if (!object(release) || release.formatVersion !== 1 || release.releaseId !== 'character-cast-v1' || release.courseSha256 !== sources.courseSha256 || !object(release.actors) || !object(release.voiceProfiles) || !object(release.stories)) throw Error('Invalid character cast release or course version');
  const stories = sources.course.stories;
  if (stories.length !== 2000 || Object.keys(release.stories).length !== stories.length) throw Error('Incomplete character cast coverage');
  for (const [id, actor] of Object.entries(release.actors)) {
    if (!object(actor) || actor.id !== id || !['label', 'species', 'wardrobe', 'personality', 'artBase'].every(key => text(actor[key])) || !/^\/comics\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(actor.artBase)) throw Error('Invalid character actor: ' + id);
  }
  for (const [id, profile] of Object.entries(release.voiceProfiles)) {
    if (!object(profile) || profile.id !== id || !release.actors[profile.actorId] || !['en', 'it'].includes(profile.language) || !text(profile.voice) || !text(profile.direction) || !Number.isFinite(profile.speed) || profile.speed < 0.5 || profile.speed > 1.5) throw Error('Invalid character voice profile: ' + id);
  }
  const usedActors = new Set(), usedProfiles = new Set();
  for (const story of stories) {
    const cast = release.stories[story.id];
    if (!object(cast) || !Array.isArray(cast.cast) || cast.cast.length !== 2 || new Set(cast.cast.map(a => a.actorId)).size !== 2 || new Set(cast.cast.map(a => a.sourceVoice)).size !== 2 || !cast.cast.some(a => a.actorId === cast.playerActorId)) throw Error('Invalid character story cast: ' + story.id);
    for (const member of cast.cast) {
      const profile = release.voiceProfiles[member.voiceProfileId];
      if (!release.actors[member.actorId] || !text(member.name) || !text(member.sourceVoice) || !profile || profile.actorId !== member.actorId || profile.language !== story.language) throw Error('Invalid character story binding: ' + story.id);
      usedActors.add(member.actorId); usedProfiles.add(member.voiceProfileId);
    }
    for (const node of Object.values(story.nodes)) for (const ref of node.clips) {
      const segment = (ref.set === 'course' ? sources.course.segments : sources.librarySegments)[ref.id];
      if (!segment || segment.language !== story.language || characterHash(segment.text) !== segment.textSha256) throw Error('Invalid character source segment: ' + ref.id);
      characterForVoice(cast, segment.voice);
    }
  }
  if (usedActors.size !== Object.keys(release.actors).length || usedProfiles.size !== Object.keys(release.voiceProfiles).length) throw Error('Unused character actor or voice profile');
  return release;
}
