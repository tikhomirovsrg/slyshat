# Character audio release

This new release revoices the immutable interactive course, including every
spoken node and every selectable answer. It does not edit published course
texts or replace the original course/library media. Story actions remain
branches, not questions with a correct and incorrect answer.

Character assignment comes from `content/characters/cast-v1.json`. Dialogue
uses the actor assigned to each original speaking slot; every answer uses the
story's player actor. Kokoro implements fixed voices and synthesis speed.
The cast's prose `direction` documents artistic intent; this engine does not
claim to render scene-specific emotions from that prose.

The English cast uses six distinct base voices. Italian has two available
base voices (`if_sara`, `im_nicola`) distributed across six character profiles
with stable speeds; these are not six distinct Italian voice identities.

## Reproduce

Use Python 3.12, Node, ffmpeg, and the pinned packages in
`scripts/character-audio/requirements.lock`, installed outside this checkout.
This locks the complete environment used for this release, including the
transitive dependencies of `scripts/kokoro-samples/requirements.txt`.
Download the two weights separately from the official release documented in
`docs/AUDIO-LIBRARY.md`. The generator checks both SHA-256 digests and the
actual voice names in the archive. It never downloads weights or calls APIs.

```bash
python scripts/character-audio/generate.py --plan
python scripts/audio-library/offline.py --check
python scripts/audio-library/offline.py scripts/character-audio/generate.py \
  --model /path/to/kokoro-v1.0.onnx \
  --voices /path/to/voices-v1.0.bin \
  --cache /outside/checkout/character-pcm-cache \
  --workers 4 --threads 2
node scripts/character-audio/validate.cjs --decode
```

`--limit 24` renders a benchmark into the reusable cache without publishing a
release. Every cache entry binds exact UTF-8 text, language, voice, speed,
model/voices hashes and renderer version. Its WAV hash and finite, non-silent
PCM are checked before reuse. Each unique synthesis job runs once, even when
several character profiles or thousands of stories reuse it.

Synthesis fails closed unless kernel-denied IPv4/IPv6 sockets are verified;
ONNX telemetry is disabled before its session is created. The supplied
`offline.py` installs the inherited seccomp filter. Do not bypass this runner.

MP3 containers are grouped by language, level and actor, then split into
bounded batches. Hashed filenames avoid overwriting bytes referenced by an
older manifest. A 1s silent guard separates clips; published cue tails include
250ms. Decoding checks every clip before publication. The manifest is copied
last, after all 2000 graphs, choices, file hashes and source hashes validate.
Do not generate directly inside a live deployment; deploy a completed build.

## Client contract

`public/audio/characters/manifest.json` contains `stories[storyId].nodes[nodeId]`
with `clips` and `choices` arrays in exact source order. Each array value is a
key into `segments`. Segment keys are `<voiceProfileId>:<sha256(exact text)>`.
A segment holds `file`, `start`, `end`, `textSha256`, `voiceProfileId`, `voice`,
`language`, and `speed`; media URLs begin `/audio/characters/`.

Technical validation does not replace expert listening. All audio remains
synthetic; no claim of human-reviewed pronunciation or acted emotions is made.
