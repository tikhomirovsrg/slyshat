// Validate the complete character release against immutable source text and cast.
// No model or Python environment is needed; --decode additionally uses ffmpeg.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  assert(args[at + 1] && !args[at + 1].startsWith('--'), `Missing ${name} value`);
  return path.resolve(args[at + 1]);
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function read(filename) {
  const bytes = fs.readFileSync(filename);
  return { value: JSON.parse(bytes), hash: sha(bytes) };
}
const course = read(option('--course', path.join(root, 'content/story-course/course-v1.json')));
const library = read(option('--library', path.join(root, 'content/audio-library/series-v1.json')));
const cast = read(option('--cast', path.join(root, 'content/characters/cast-v1.json')));
const manifestPath = option('--manifest', path.join(root, 'public/audio/characters/manifest.json'));
// Development checkpoints can run on the preserved legacy recordings. A
// present release is always validated in full, including with --if-present.
if (!fs.existsSync(manifestPath) && args.includes('--if-present')) {
  console.log('Character audio release is not published yet; using existing course/library recordings.');
  process.exit(0);
}
const mediaRoot = path.dirname(manifestPath);
const manifest = read(manifestPath).value;
assert.equal(manifest.formatVersion, 1);
assert.equal(manifest.releaseId, 'character-audio-v1');
assert.equal(manifest.modelSha256, 'beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a');
assert.equal(manifest.voicesSha256, 'bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d');
assert.equal(manifest.sampleRate, 24000);
assert.equal(manifest.codec, 'mp3');
assert.equal(manifest.readyStories, 2000);
assert.equal(manifest.courseSha256, course.hash);
assert.equal(manifest.librarySha256, library.hash);
assert.equal(manifest.castSha256, cast.hash);
assert.equal(course.value.stories.length, 2000);
const storyIds = course.value.stories.map(s => s.id).sort();
assert.equal(new Set(storyIds).size, 2000);
assert.deepEqual(Object.keys(manifest.stories).sort(), storyIds);
assert.deepEqual(Object.keys(cast.value.stories).sort(), storyIds);
const usedClips = new Set(), usedFiles = new Set(), intervals = new Map();
let placements = 0, choices = 0;
const sources = { course: course.value, library: library.value };
function checkClip(key, text, profile, label) {
  const textSha256 = sha(Buffer.from(text, 'utf8'));
  assert.equal(key, `${profile.id}:${textSha256}`, `${label}: wrong ordered clip key`);
  const clip = manifest.segments[key];
  assert(clip, `${label}: missing segment`);
  assert.equal(clip.textSha256, textSha256, `${label}: wrong exact text`);
  assert.equal(clip.voiceProfileId, profile.id, `${label}: wrong actor voice`);
  assert.equal(clip.voice, profile.voice);
  assert.equal(clip.speed, profile.speed);
  assert.equal(clip.language, profile.language);
  const file = manifest.files[clip.file];
  assert(file, `${label}: missing audio file metadata`);
  assert(Number.isFinite(clip.start) && Number.isFinite(clip.end));
  assert(clip.start >= 0 && clip.end > clip.start && clip.end <= file.duration);
  usedClips.add(key); usedFiles.add(clip.file);
  if (!intervals.has(clip.file)) intervals.set(clip.file, new Map());
  const intervalKey = `${clip.start}:${clip.end}`;
  const previous = intervals.get(clip.file).get(intervalKey);
  if (previous) assert.deepEqual(previous, [textSha256, clip.voice, clip.language, clip.speed], 'Shared PCM must have identical synthesis inputs');
  else intervals.get(clip.file).set(intervalKey, [textSha256, clip.voice, clip.language, clip.speed]);
}
for (const story of course.value.stories) {
  const assignment = cast.value.stories[story.id];
  const mapped = manifest.stories[story.id];
  assert.deepEqual(Object.keys(mapped.nodes).sort(), Object.keys(story.nodes).sort());
  const players = assignment.cast.filter(m => m.actorId === assignment.playerActorId);
  assert.equal(players.length, 1);
  const player = cast.value.voiceProfiles[players[0].voiceProfileId];
  assert(player && player.language === story.language);
  const visited = new Set(), visiting = new Set();
  function visit(nodeId) {
    assert(!visiting.has(nodeId), `${story.id}: graph cycle`);
    if (visited.has(nodeId)) return;
    assert(story.nodes[nodeId], `${story.id}: dangling edge`);
    visiting.add(nodeId);
    const node = story.nodes[nodeId], target = mapped.nodes[nodeId];
    assert.equal(target.clips.length, node.clips.length, `${story.id}/${nodeId}: clip omission`);
    assert.equal(target.choices.length, node.choices.length, `${story.id}/${nodeId}: choice omission`);
    node.clips.forEach((reference, index) => {
      const source = sources[reference.set]?.segments[reference.id];
      assert(source && sha(Buffer.from(source.text, 'utf8')) === source.textSha256);
      const members = assignment.cast.filter(m => m.sourceVoice === source.voice);
      assert.equal(members.length, 1, 'Every original speaking slot needs one actor');
      const profile = cast.value.voiceProfiles[members[0].voiceProfileId];
      assert(profile && profile.actorId === members[0].actorId && profile.language === story.language);
      checkClip(target.clips[index], source.text, profile, `${story.id}/${nodeId}/clip/${index}`);
      placements++;
    });
    node.choices.forEach((choice, index) => {
      checkClip(target.choices[index], choice.text, player, `${story.id}/${nodeId}/choice/${index}`);
      choices++; visit(choice.next);
    });
    if (!node.choices.length) assert(node.outcome?.title && node.outcome?.body, 'Terminal node has no ending');
    visiting.delete(nodeId); visited.add(nodeId);
  }
  visit(story.start);
  assert.equal(visited.size, Object.keys(story.nodes).length, `${story.id}: unreachable source node`);
}
assert.deepEqual([...usedClips].sort(), Object.keys(manifest.segments).sort(), 'Unused/missing manifest segments');
assert.deepEqual([...usedFiles].sort(), Object.keys(manifest.files).sort(), 'Unused/missing audio containers');
for (const [filename, info] of Object.entries(manifest.files)) {
  assert(/^[a-z0-9-]+\.mp3$/.test(filename), 'Unsafe media filename');
  assert(Number.isFinite(info.duration) && info.duration > 0);
  const file = path.join(mediaRoot, filename), bytes = fs.readFileSync(file);
  assert(bytes.length > 0 && bytes.length < 100_000_000, 'MP3 size limit');
  assert.equal(bytes.length, info.bytes); assert.equal(sha(bytes), info.sha256);
  const bounds = [...intervals.get(filename).keys()].map(s => s.split(':').map(Number)).sort((a,b) => a[0]-b[0]);
  for (let i = 1; i < bounds.length; i++) assert(bounds[i][0] >= bounds[i-1][1], 'Overlapping distinct speech segments');
  if (args.includes('--decode')) {
    const result = spawnSync('ffprobe', ['-v','error','-show_entries','stream=codec_name,sample_rate,channels','-of','json',file], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const streams = JSON.parse(result.stdout).streams;
    assert.equal(streams.length, 1); assert.equal(streams[0].codec_name, 'mp3');
    assert.equal(streams[0].sample_rate, '24000'); assert.equal(streams[0].channels, 1);
    const decoded = spawnSync('ffmpeg', ['-v','error','-i',file,'-f','f32le','-ac','1','-ar','24000','pipe:1'], {maxBuffer:512*1024*1024});
    assert.equal(decoded.status, 0, decoded.stderr?.toString());
    assert.equal(decoded.stdout.length % 4, 0);
    assert(Math.abs(decoded.stdout.length / 4 / 24000 - info.duration) < 0.02, 'Decoded duration mismatch');
    for (const [start,end] of bounds) {
      let peak = 0;
      for (let n = Math.round(start*24000); n < Math.round(end*24000); n++) {
        const value = decoded.stdout.readFloatLE(n*4);
        assert(Number.isFinite(value), 'Nonfinite decoded sample'); peak = Math.max(peak, Math.abs(value));
      }
      assert(peak > 0.005, 'Silent decoded speech segment');
    }
  }
}
console.log(`PASS: 2000 character stories, ${placements} ordered dialogue clips, ${choices} player choices, ${usedClips.size} bound segments, ${usedFiles.size} checked MP3 files${args.includes('--decode') ? ', full decoding' : ''}.`);
