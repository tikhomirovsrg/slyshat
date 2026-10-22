"""Source-bound audio for story-expansion-v1, using the existing offline runtime.

--cache-only accepts an incomplete authoring batch; it never publishes a manifest.
Full publication requires all 246 validated stories and all dialogue/answer audio.
Run synthesis through scripts/audio-library/offline.py with explicit local weights.
"""
from __future__ import annotations
import argparse
import collections
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("character_renderer", ROOT / "scripts/character-audio/generate.py")
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

LEVEL_SPEED = {"en": {"A1": .78, "A2": .86, "B1": .94, "B2": 1, "C1": 1},
               "it": {"A1": .85, "A2": .90, "B1": .97, "B2": 1, "C1": 1}}


def make_plan(partial=False):
    code = "import {readExpansion} from './lib/story-expansion.mjs'; console.log(JSON.stringify(readExpansion(process.cwd(),{complete:" + ("false" if partial else "true") + "})));"
    release = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", code], cwd=ROOT, text=True))
    cast_path = ROOT / "content/characters/cast-v1.json"
    cast = renderer.read_json(cast_path)
    jobs, clips = {}, {}

    def add(story, text, actor_id, clip_id):
        profile = cast["voiceProfiles"][actor_id + "-" + story["language"]]
        speed = round(profile["speed"] * LEVEL_SPEED[story["language"]][story["level"]], 4)
        key = renderer.identity(text, story["language"], profile["voice"], speed)
        jobs[key] = dict(key=key, text=text, language=story["language"], level=story["level"], voice=profile["voice"], speed=speed, actorId=actor_id)
        clips[clip_id] = dict(jobKey=key, storyId=story["id"], textSha256=renderer.text_digest(text), actorId=actor_id,
                              voice=profile["voice"], voiceProfileId=profile["id"], language=story["language"], speed=speed)

    for story in release["stories"]:
        for node_id, node in story["nodes"].items():
            for index, line in enumerate(node["lines"]):
                add(story, line["text"], story["cast"][line["speaker"]]["actorId"], f"{story['id']}:{node_id}:line:{index}")
            for index, choice in enumerate(node["choices"]):
                add(story, choice["text"], story["cast"][0]["actorId"], f"{story['id']}:{node_id}:choice:{index}")
    return dict(release=release, jobs=jobs, clips=clips, castSha256=renderer.digest(cast_path))


def init_worker(model, voices, threads):
    renderer.initialise(model, voices, threads)


def render_job(job, cache):
    return renderer.render(job, cache)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path)
    parser.add_argument("--voices", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--batch-seconds", type=int, default=40,
                        help="Target MP3 container length, 30–90 seconds; clips stay intact")
    parser.add_argument("--cache-only", action="store_true")
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "public/audio/expansion")
    args = parser.parse_args()
    if not 30 <= args.batch_seconds <= 90:
        parser.error("Use a 30–90 second MP3 batch target")
    plan = make_plan(args.cache_only)
    print(json.dumps(dict(stories=len(plan["release"]["stories"]), jobs=len(plan["jobs"]), clips=len(plan["clips"]), sourceSha256=plan["release"]["checksum"])), flush=True)
    if args.plan:
        return
    renderer.require_offline()
    if not args.model or not args.voices or not args.cache:
        parser.error("Explicit model, voices and cache paths are required")
    if not 1 <= args.workers <= 4 or not 1 <= args.threads <= 4:
        raise ValueError("Use 1–4 workers and threads")
    if renderer.digest(args.model) != renderer.MODEL_SHA or renderer.digest(args.voices) != renderer.VOICES_SHA:
        raise ValueError("Weight checksum mismatch")
    cache = args.cache.resolve()
    if cache.is_relative_to(ROOT):
        raise ValueError("Audio cache must stay outside Git")
    cache.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(cache)
    tempfile.tempdir = str(cache)
    import numpy as np
    import soundfile as sf
    renderer.NP, renderer.SF = np, sf
    with np.load(args.voices, allow_pickle=False) as voices:
        if {job["voice"] for job in plan["jobs"].values()} - set(voices.files):
            raise ValueError("Voice unavailable in local weights")
    started, results, hits = time.monotonic(), {}, 0
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers, initializer=init_worker,
            initargs=(str(args.model), str(args.voices), args.threads)) as pool:
        futures = [pool.submit(render_job, job, str(cache)) for job in plan["jobs"].values()]
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            key, filename, length, hit = future.result()
            results[key] = (filename, length)
            hits += hit
            if count % 20 == 0 or count == len(futures):
                print(f"PCM {count}/{len(futures)}, cached {hits}, elapsed {time.monotonic()-started:.1f}s", flush=True)
    if args.cache_only:
        print("CACHE ONLY: no published recordings or readiness claims", flush=True)
        return
    # Re-read after synthesis so an author's concurrent edit cannot attach old
    # audio to new text. Cached jobs remain reusable for a clean subsequent run.
    if make_plan(False)["release"]["checksum"] != plan["release"]["checksum"]:
        raise ValueError("Story source changed during synthesis; rerun from cache")
    staging = cache / ("release-" + plan["release"]["checksum"][:16])
    staging.mkdir(parents=True, exist_ok=True)
    manifest = dict(formatVersion=1, releaseId="story-expansion-audio-v1", sourceSha256=plan["release"]["checksum"],
                    castSha256=plan["castSha256"], modelSha256=renderer.MODEL_SHA, voicesSha256=renderer.VOICES_SHA,
                    model="Kokoro-82M v1.0", engine="kokoro-onnx 0.6.1", sampleRate=renderer.SAMPLE_RATE,
                    codec="mp3", bitrate=64000, readyStories=len(plan["release"]["stories"]),
                    files={}, segments={}, levelSpeed=LEVEL_SPEED, batchSeconds=args.batch_seconds)
    groups = collections.defaultdict(list)
    for job in plan["jobs"].values():
        groups[(job["language"], job["level"], job["actorId"])].append(job["key"])
    cues = {}
    for group, keys in groups.items():
        batch, seconds, number = [], 0, 1
        for key in keys + [None]:
            duration = results[key][1] / renderer.SAMPLE_RATE + 1 if key else 0
            # Small immutable files are easy to seek and transfer. A single
            # longer utterance remains intact instead of splitting a word.
            if batch and (key is None or seconds + duration > args.batch_seconds):
                filename, info, packed = renderer.encode_batch(batch, group, number, results, staging)
                manifest["files"][filename] = info
                cues.update(packed)
                print("PACK", filename, info["bytes"], flush=True)
                batch, seconds, number = [], 0, number + 1
            if key is not None:
                batch.append(key)
                seconds += duration
    for clip_id, clip in plan["clips"].items():
        manifest["segments"][clip_id] = {**{key: value for key, value in clip.items() if key != "jobKey"}, **cues[clip["jobKey"]]}
    manifest_path = staging / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["node", str(ROOT / "scripts/story-expansion/validate-audio.mjs"), "--directory", str(staging)], cwd=ROOT, check=True)
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, info in manifest["files"].items():
        temporary = args.output / (filename + ".tmp")
        shutil.copyfile(staging / filename, temporary)
        if renderer.digest(temporary) != info["sha256"]:
            raise ValueError("Audio publication checksum mismatch")
        temporary.replace(args.output / filename)
    temporary = args.output / "manifest.json.tmp"
    shutil.copyfile(manifest_path, temporary)
    temporary.replace(args.output / "manifest.json")
    print(f"DONE: {manifest['readyStories']} stories, {len(plan['jobs'])} jobs, {len(manifest['files'])} MP3", flush=True)


if __name__ == "__main__":
    main()
