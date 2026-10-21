import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {characterForVoice, characterHash} from './character-cast.mjs';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sameKeys = (object, keys) => object && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
export const characterClipKey = (profileId, text) => profileId + ':' + characterHash(text);

// Validate the whole release before serving even one new recording. An absent
// manifest means legacy audio; a present but incomplete/stale manifest is an
// installation error, never a claim that the old recordings match new voices.
export function validateCharacterAudio(manifest, cast, sources, castSha256, audioDirectory) {
  if (!manifest || manifest.formatVersion !== 1 || manifest.releaseId !== 'character-audio-v1' || manifest.castSha256 !== castSha256 || manifest.courseSha256 !== sources.courseSha256 || manifest.librarySha256 !== sources.librarySha256 || !hash(manifest.modelSha256) || !hash(manifest.voicesSha256) || manifest.sampleRate !== 24000 || manifest.readyStories !== 2000 || !manifest.files || !manifest.segments || !sameKeys(manifest.stories, sources.course.stories.map(s => s.id))) throw Error('Invalid character audio release or source version');
  const referenced = new Set(), usedFiles = new Set();
  function check(key, profileId, text, language) {
    const profile = cast.voiceProfiles[profileId], clip = manifest.segments[key];
    if (key !== characterClipKey(profileId, text) || !profile || !clip || clip.textSha256 !== characterHash(text) || clip.voiceProfileId !== profileId || clip.voice !== profile.voice || clip.language !== language || clip.speed !== profile.speed) throw Error('Character audio does not match text or voice profile');
    const file = manifest.files[clip.file];
    if (!file || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp3$/.test(clip.file) || !hash(file.sha256) || !Number.isInteger(file.bytes) || file.bytes <= 0 || !Number.isFinite(file.duration) || file.duration <= 0 || !Number.isFinite(clip.start) || !Number.isFinite(clip.end) || clip.start < 0 || clip.end <= clip.start || clip.end > file.duration + 0.05) throw Error('Invalid character audio cue or file');
    referenced.add(key); usedFiles.add(clip.file);
  }
  for (const story of sources.course.stories) {
    const assignment = cast.stories[story.id], recorded = manifest.stories[story.id];
    const player = assignment.cast.find(a => a.actorId === assignment.playerActorId);
    if (!recorded || !sameKeys(recorded.nodes, Object.keys(story.nodes))) throw Error('Incomplete character audio scene coverage: ' + story.id);
    for (const [id, node] of Object.entries(story.nodes)) {
      const entry = recorded.nodes[id];
      if (!entry || !Array.isArray(entry.clips) || !Array.isArray(entry.choices) || entry.clips.length !== node.clips.length || entry.choices.length !== node.choices.length) throw Error('Incomplete character audio dialogue or choices: ' + story.id + '/' + id);
      node.clips.forEach((ref, index) => {
        const data = (ref.set === 'course' ? sources.course.segments : sources.librarySegments)[ref.id];
        check(entry.clips[index], characterForVoice(assignment, data.voice).voiceProfileId, data.text, story.language);
      });
      node.choices.forEach((choice, index) => check(entry.choices[index], player.voiceProfileId, choice.text, story.language));
    }
  }
  if (referenced.size !== Object.keys(manifest.segments).length || usedFiles.size !== Object.keys(manifest.files).length) throw Error('Unreferenced character audio segments or files');
  if (audioDirectory) for (const filename of usedFiles) {
    const bytes = readFileSync(resolve(audioDirectory, filename)), file = manifest.files[filename];
    if (bytes.length !== file.bytes || characterHash(bytes) !== file.sha256) throw Error('Character recording checksum mismatch: ' + filename);
  }
  return manifest;
}

export function loadCharacterAudio(cast, sources, castSha256, directory = resolve(process.cwd(), 'public/audio/characters')) {
  const path = resolve(directory, 'manifest.json');
  if (!existsSync(path)) return null;
  return validateCharacterAudio(JSON.parse(readFileSync(path, 'utf8')), cast, sources, castSha256, directory);
}
