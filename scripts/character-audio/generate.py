"""Build a complete, source-bound character audio release using local Kokoro.

Planning needs only Python. Synthesis MUST run through audio-library/offline.py.
Weights are explicit inputs, never downloaded here. All resumable work stays in
--cache, outside the checkout; publication happens only after full validation.
"""
from __future__ import annotations

import argparse
import collections
import concurrent.futures
import errno
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
MODEL_SHA = "beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a"
VOICES_SHA = "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d"
SAMPLE_RATE = 24000
MODEL = None
NP = None
SF = None


def digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def identity(text: str, language: str, voice: str, speed: float) -> str:
    value = ["character-pcm-v1", MODEL_SHA, VOICES_SHA, "kokoro-onnx-0.6.1",
             language, voice, speed, text]
    return text_digest(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def make_plan(course_path: Path, library_path: Path, cast_path: Path):
    course, library, cast = map(read_json, [course_path, library_path, cast_path])
    if len(course["stories"]) != 2000:
        raise ValueError("Expected the complete immutable 2000-story course")
    if set(cast["stories"]) != {s["id"] for s in course["stories"]}:
        raise ValueError("Character cast must cover exactly the source stories")
    sources = {"course": course, "library": library}
    jobs, clips, story_map = {}, {}, {}
    counts = collections.Counter()
    profiles = cast["voiceProfiles"]

    def add(text, profile, story):
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Empty speech text")
        if profile["id"] not in profiles or profile["language"] != story["language"]:
            raise ValueError("Missing or wrong-language voice profile")
        speed = profile["speed"]
        if isinstance(speed, bool) or not isinstance(speed, (int, float)) or not 0.5 <= speed <= 2:
            raise ValueError("Invalid synthesis speed")
        sha = text_digest(text)
        clip_key = profile["id"] + ":" + sha
        job_key = identity(text, story["language"], profile["voice"], speed)
        job = dict(key=job_key, text=text, language=story["language"],
                   voice=profile["voice"], speed=speed, level=story["level"],
                   actorId=profile["actorId"])
        jobs.setdefault(job_key, job)
        clip = dict(jobKey=job_key, textSha256=sha, voiceProfileId=profile["id"],
                    voice=profile["voice"], language=story["language"], speed=speed)
        if clip_key in clips and clips[clip_key] != clip:
            raise ValueError("Conflicting clip identity")
        clips[clip_key] = clip
        return clip_key

    for story in course["stories"]:
        assignment = cast["stories"][story["id"]]
        members = assignment["cast"]
        by_source = {}
        for member in members:
            profile = profiles[member["voiceProfileId"]]
            if profile["actorId"] != member["actorId"]:
                raise ValueError("Cast actor and voice actor disagree")
            if member["sourceVoice"] in by_source:
                raise ValueError("Ambiguous source-voice cast")
            by_source[member["sourceVoice"]] = profile
        players = [m for m in members if m["actorId"] == assignment["playerActorId"]]
        if len(players) != 1:
            raise ValueError("Expected exactly one player actor in the cast")
        player = profiles[players[0]["voiceProfileId"]]
        nodes = {}
        for node_id, node in story["nodes"].items():
            lines, choices = [], []
            for reference in node["clips"]:
                source = sources[reference["set"]]["segments"][reference["id"]]
                if source["language"] != story["language"] or text_digest(source["text"]) != source["textSha256"]:
                    raise ValueError("Source speech checksum/language mismatch")
                lines.append(add(source["text"], by_source[source["voice"]], story))
                counts["dialoguePlacements"] += 1
            for choice in node["choices"]:
                if choice["next"] not in story["nodes"]:
                    raise ValueError("Dangling story choice")
                choices.append(add(choice["text"], player, story))
                counts["choicePlacements"] += 1
            nodes[node_id] = dict(clips=lines, choices=choices)
        story_map[story["id"]] = dict(nodes=nodes)
    counts.update(stories=len(story_map), uniqueJobs=len(jobs), clipKeys=len(clips))
    counts["uniqueWords"] = sum(len(job["text"].split()) for job in jobs.values())
    return dict(jobs=jobs, clips=clips, stories=story_map, counts=dict(counts),
                castSha256=digest(cast_path), courseSha256=digest(course_path),
                librarySha256=digest(library_path))


def require_offline():
    """Fail before importing any synthesizer unless Internet sockets are denied."""
    for family in (socket.AF_INET, socket.AF_INET6):
        try:
            probe = socket.socket(family, socket.SOCK_STREAM)
        except OSError as error:
            if error.errno != errno.EPERM:
                raise RuntimeError("Cannot verify seccomp Internet-socket denial") from error
        else:
            probe.close()
            raise RuntimeError("Run through scripts/audio-library/offline.py; Internet sockets are permitted")


def initialise(model_path: str, voices_path: str, threads: int):
    global MODEL, NP, SF
    require_offline()
    import numpy as np
    import soundfile as sf
    import onnxruntime as rt
    NP, SF = np, sf
    rt.disable_telemetry_events()
    from kokoro_onnx import Kokoro
    options = rt.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    options.log_severity_level = 3
    session = rt.InferenceSession(model_path, sess_options=options,
                                  providers=["CPUExecutionProvider"])
    MODEL = Kokoro.from_session(session, voices_path)


def validate_pcm(samples, sample_rate):
    if (sample_rate != SAMPLE_RATE or samples.ndim != 1 or len(samples) < 1200
            or not NP.isfinite(samples).all() or float(NP.abs(samples).max()) < 0.005):
        raise ValueError("Invalid, nonfinite or silent speech")


def render(job, cache):
    path = Path(cache) / (job["key"] + ".wav")
    metadata = path.with_suffix(".json")
    # Trust a resumed entry only after checking its byte hash and PCM contents.
    if path.exists() and metadata.exists():
        info = read_json(metadata)
        if info.get("key") == job["key"] and info.get("sha256") == digest(path):
            samples, rate = SF.read(path, dtype="float32")
            validate_pcm(samples, rate)
            if len(samples) == info.get("samples"):
                return job["key"], str(path), len(samples), True
    samples, rate = MODEL.create(job["text"], voice=job["voice"],
                                 lang="it" if job["language"] == "it" else "en-gb",
                                 speed=job["speed"])
    validate_pcm(samples, rate)
    peak = float(NP.abs(samples).max())
    if peak > 0.98:
        samples = samples * (0.98 / peak)
    temporary = path.with_suffix(".tmp.wav")
    SF.write(temporary, samples, rate, subtype="PCM_16")
    temporary.replace(path)
    info = dict(key=job["key"], sha256=digest(path), samples=len(samples), sampleRate=rate)
    temporary = metadata.with_suffix(".tmp.json")
    temporary.write_text(json.dumps(info) + "\n", encoding="utf-8")
    temporary.replace(metadata)
    return job["key"], str(path), len(samples), False


def encode_batch(batch, group, batch_number, results, staging):
    """Keep a 1s silent guard; segment cues include a 250ms natural tail."""
    wav_path = staging / "packing.wav"
    cursor, cues = 0, {}
    with SF.SoundFile(wav_path, "w", samplerate=SAMPLE_RATE, channels=1, subtype="PCM_16") as output:
        for job_key in batch:
            samples, rate = SF.read(results[job_key][0], dtype="float32")
            validate_pcm(samples, rate)
            cues[job_key] = dict(start=round(cursor / SAMPLE_RATE, 6),
                                 end=round((cursor + len(samples) + 6000) / SAMPLE_RATE, 6))
            output.write(samples)
            output.write(NP.zeros(SAMPLE_RATE, dtype="float32"))
            cursor += len(samples) + SAMPLE_RATE
    temporary = staging / "packing.mp3"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
                    "-codec:a", "libmp3lame", "-b:a", "64k", str(temporary)], check=True)
    # Seek metadata/Xing remains enabled, so decoded timing excludes encoder delay.
    decoded_path = staging / "decoded.f32"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(temporary),
                    "-f", "f32le", "-ac", "1", "-ar", str(SAMPLE_RATE), str(decoded_path)], check=True)
    decoded = NP.memmap(decoded_path, dtype="<f4", mode="r")
    validate_pcm(decoded, SAMPLE_RATE)
    duration = len(decoded) / SAMPLE_RATE
    if abs(duration - cursor / SAMPLE_RATE) > 0.02:
        raise ValueError("MP3 decode duration differs from PCM timeline")
    for cue in cues.values():
        first, last = round(cue["start"] * SAMPLE_RATE), round(cue["end"] * SAMPLE_RATE)
        validate_pcm(decoded[first:last], SAMPLE_RATE)
    del decoded
    sha = digest(temporary)
    filename = "-".join(group).lower() + f"-{batch_number:03d}-{sha[:12]}.mp3"
    target = staging / filename
    temporary.replace(target)
    if not 0 < target.stat().st_size < 100_000_000:
        raise ValueError("MP3 must be nonempty and smaller than 100MB")
    for cue in cues.values():
        cue["file"] = filename
    wav_path.unlink()
    decoded_path.unlink()
    return filename, dict(sha256=sha, bytes=target.stat().st_size, duration=duration), cues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course", type=Path, default=ROOT / "content/story-course/course-v1.json")
    parser.add_argument("--library", type=Path, default=ROOT / "content/audio-library/series-v1.json")
    parser.add_argument("--cast", type=Path, default=ROOT / "content/characters/cast-v1.json")
    parser.add_argument("--output", type=Path, default=ROOT / "public/audio/characters")
    parser.add_argument("--model", type=Path)
    parser.add_argument("--voices", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument("--max-batch-seconds", type=int, default=900)
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--limit", type=int, help="Benchmark only: render N jobs into cache, do not publish")
    args = parser.parse_args()
    plan = make_plan(args.course, args.library, args.cast)
    print(json.dumps(plan["counts"], ensure_ascii=False), flush=True)
    print("voices:", sorted({job["voice"] for job in plan["jobs"].values()}), flush=True)
    if args.plan:
        return
    require_offline()
    if not args.model or not args.voices or not args.cache:
        parser.error("Synthesis requires --model, --voices and --cache")
    if not 1 <= args.workers <= 4 or not 1 <= args.threads <= 4:
        raise ValueError("Use 1–4 workers and threads")
    if not 60 <= args.max_batch_seconds <= 3600 or (args.limit is not None and args.limit <= 0):
        raise ValueError("Invalid batch duration or benchmark limit")
    if digest(args.model) != MODEL_SHA or digest(args.voices) != VOICES_SHA:
        raise ValueError("Model/voice checksum mismatch")
    cache = args.cache.resolve()
    if cache.is_relative_to(ROOT):
        raise ValueError("PCM cache must be outside the checkout")
    cache.mkdir(parents=True, exist_ok=True)
    os.environ["TMPDIR"] = str(cache)
    tempfile.tempdir = str(cache)
    global NP, SF
    import numpy as np
    import soundfile as sf
    NP, SF = np, sf
    with np.load(args.voices, allow_pickle=False) as voices:
        missing = {job["voice"] for job in plan["jobs"].values()} - set(voices.files)
        if missing:
            raise ValueError("Unavailable Kokoro voices: " + ", ".join(sorted(missing)))
    started, results, hits = time.monotonic(), {}, 0
    jobs = list(plan["jobs"].values())
    if args.limit:
        # Spread benchmarks across the catalogue, languages and levels.
        count = min(args.limit, len(jobs))
        jobs = [jobs[index * len(jobs) // count] for index in range(count)]
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers, initializer=initialise,
            initargs=(str(args.model), str(args.voices), args.threads)) as pool:
        futures = [pool.submit(render, job, str(cache)) for job in jobs]
        for number, future in enumerate(concurrent.futures.as_completed(futures), 1):
            key, filename, length, hit = future.result()
            results[key] = (filename, length)
            hits += hit
            if number % 20 == 0 or number == len(jobs):
                print(f"PCM {number}/{len(jobs)}, cached {hits}, elapsed {time.monotonic()-started:.1f}s", flush=True)
    speech_seconds = sum(length / SAMPLE_RATE for _, length in results.values())
    print(f"PCM ready: {speech_seconds:.1f}s speech, {time.monotonic()-started:.1f}s wall time", flush=True)
    if args.limit:
        print("BENCHMARK ONLY: no release files published", flush=True)
        return
    staging = cache / ("release-staging-" + plan["castSha256"][:16])
    staging.mkdir(parents=True, exist_ok=True)
    manifest = dict(formatVersion=1, releaseId="character-audio-v1", model="Kokoro-82M v1.0",
                    modelSha256=MODEL_SHA, voicesSha256=VOICES_SHA, engine="kokoro-onnx 0.6.1",
                    sampleRate=SAMPLE_RATE, codec="mp3", bitrate=64000,
                    readyStories=len(plan["stories"]), files={}, segments={}, stories=plan["stories"],
                    statistics=plan["counts"], **{k: plan[k] for k in ("castSha256", "courseSha256", "librarySha256")})
    groups = collections.defaultdict(list)
    for job in plan["jobs"].values():
        groups[(job["language"], job["level"], job["actorId"])].append(job["key"])
    all_cues = {}
    for group, keys in groups.items():
        batch, seconds, number = [], 0, 1
        for key in keys + [None]:
            duration = results[key][1] / SAMPLE_RATE + 1 if key else 0
            if batch and (key is None or seconds + duration > args.max_batch_seconds):
                filename, info, cues = encode_batch(batch, group, number, results, staging)
                manifest["files"][filename] = info
                all_cues.update(cues)
                print("PACK", filename, info["bytes"], flush=True)
                batch, seconds, number = [], 0, number + 1
            if key is not None:
                batch.append(key)
                seconds += duration
    for key, clip in plan["clips"].items():
        manifest["segments"][key] = {**{k: v for k, v in clip.items() if k != "jobKey"},
                                     **all_cues[clip["jobKey"]]}
    manifest_path = staging / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    subprocess.run(["node", str(Path(__file__).with_name("validate.cjs")), "--manifest", str(manifest_path),
                    "--course", str(args.course), "--library", str(args.library), "--cast", str(args.cast)], check=True)
    # Hashes bind media filenames: old manifests keep referring to their own bytes.
    args.output.mkdir(parents=True, exist_ok=True)
    for filename in manifest["files"]:
        temporary = args.output / (filename + ".tmp")
        shutil.copyfile(staging / filename, temporary)
        if digest(temporary) != manifest["files"][filename]["sha256"]:
            raise ValueError("Publication copy checksum mismatch")
        temporary.replace(args.output / filename)
    temporary = args.output / "manifest.json.tmp"
    shutil.copyfile(manifest_path, temporary)
    temporary.replace(args.output / "manifest.json")
    print(f"DONE: {len(plan['stories'])} stories, {len(jobs)} unique jobs, "
          f"{len(manifest['files'])} MP3, {time.monotonic()-started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
