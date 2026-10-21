#!/usr/bin/env python3
"""Create or restore a source-bound, lossless partial PCM checkpoint (no synthesis)."""
import argparse
import datetime
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import wave

ROOT = Path(__file__).resolve().parents[2]
MAX_PART_BYTES = 7_500_000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def generator():
    spec = importlib.util.spec_from_file_location('character_generator', Path(__file__).with_name('generate.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def archive(members):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        for name, data in members:
            info = tarfile.TarInfo(name)
            info.size, info.mtime, info.mode = len(data), 0, 0o644
            tar.addfile(info, io.BytesIO(data))
    return gzip.compress(raw.getvalue(), compresslevel=4, mtime=0)


def create(cache, output):
    if output.exists() and any(output.iterdir()):
        raise ValueError('Refusing to overwrite an existing checkpoint')
    output.mkdir(parents=True, exist_ok=True)
    gen = generator()
    plan = gen.make_plan(ROOT/'content/story-course/course-v1.json', ROOT/'content/audio-library/series-v1.json', ROOT/'content/characters/cast-v1.json')
    manifest = dict(formatVersion=1, checkpointId='character-pcm-checkpoint-v1', ready=False,
                    purpose='Resumable partial PCM cache; not a playable audio release',
                    createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    rendererVersion='character-pcm-v1/kokoro-onnx-0.6.1',
                    generatorSha256=sha(Path(__file__).with_name('generate.py').read_bytes()),
                    modelSha256=gen.MODEL_SHA, voicesSha256=gen.VOICES_SHA,
                    plannedJobs=len(plan['jobs']), entries={}, parts={},
                    **{key:plan[key] for key in ('castSha256','courseSha256','librarySha256')})
    # Freeze candidate names before reading: synthesis may keep adding new files.
    candidates=[key for key in sorted(plan['jobs']) if (cache/(key+'.wav')).is_file() and (cache/(key+'.json')).is_file()]
    batch, raw_size = [], 0

    def publish(members):
        packed=archive(members)
        if len(packed)>MAX_PART_BYTES:
            if len(members)<=2:
                raise ValueError('One cache entry exceeds the checkpoint part limit')
            split=(len(members)//4)*2
            publish(members[:split]);publish(members[split:]);return
        name=f'pcm-{len(manifest["parts"])+1:03d}.tar.gz'
        (output/name).write_bytes(packed)
        manifest['parts'][name]=dict(bytes=len(packed),sha256=sha(packed),members=[name for name,_ in members])
        for filename,_ in members:
            manifest['entries'][Path(filename).stem]['part']=name
        print('CHECKPOINT PART',name,len(packed),flush=True)

    for key in candidates:
        wav=(cache/(key+'.wav')).read_bytes()
        metadata=(cache/(key+'.json')).read_bytes()
        info=json.loads(metadata)
        if info.get('key')!=key or info.get('sha256')!=sha(wav):
            raise ValueError('Cache checksum mismatch: '+key)
        with wave.open(io.BytesIO(wav),'rb') as audio:
            if (audio.getnchannels(),audio.getsampwidth(),audio.getframerate(),audio.getnframes())!=(1,2,24000,info.get('samples')):
                raise ValueError('Invalid PCM cache format: '+key)
        manifest['entries'][key]=dict(wavSha256=sha(wav),wavBytes=len(wav),metadataSha256=sha(metadata),metadataBytes=len(metadata),samples=info['samples'])
        if batch and raw_size+len(wav)+len(metadata)>12_000_000:
            publish(batch);batch=[];raw_size=0
        batch.extend([(key+'.wav',wav),(key+'.json',metadata)])
        raw_size+=len(wav)+len(metadata)
    if batch:publish(batch)
    manifest['completedJobs']=len(manifest['entries'])
    manifest['speechSeconds']=sum(entry['samples'] for entry in manifest['entries'].values())/24000
    manifest['archiveBytes']=sum(part['bytes'] for part in manifest['parts'].values())
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({key:manifest[key] for key in ('completedJobs','plannedJobs','speechSeconds','archiveBytes')})+f', parts={len(manifest["parts"])}',flush=True)


def restore(checkpoint, cache):
    if cache.is_relative_to(ROOT):
        raise ValueError('Restore PCM outside the checkout')
    manifest=json.loads((checkpoint/'manifest.json').read_text())
    if manifest.get('formatVersion')!=1 or manifest.get('ready') is not False:
        raise ValueError('Not a partial PCM checkpoint')
    expected={}
    for key,entry in manifest['entries'].items():
        expected[key+'.wav']=(entry['wavSha256'],entry['wavBytes'])
        expected[key+'.json']=(entry['metadataSha256'],entry['metadataBytes'])
    cache.mkdir(parents=True,exist_ok=True)
    seen=set()
    for filename,part in manifest['parts'].items():
        if Path(filename).name!=filename or not filename.endswith('.tar.gz'):
            raise ValueError('Invalid part name')
        packed=(checkpoint/filename).read_bytes()
        if len(packed)!=part['bytes'] or sha(packed)!=part['sha256']:
            raise ValueError('Checkpoint part checksum mismatch: '+filename)
        names=[]
        with tarfile.open(fileobj=io.BytesIO(packed),mode='r:gz') as tar:
            for member in tar:
                if not member.isfile() or member.name not in expected or member.name in seen or Path(member.name).name!=member.name:
                    raise ValueError('Invalid or duplicate archive member')
                data=tar.extractfile(member).read()
                digest,size=expected[member.name]
                if len(data)!=size or sha(data)!=digest:
                    raise ValueError('Cache member checksum mismatch')
                temporary=cache/(member.name+'.restoring')
                temporary.write_bytes(data);temporary.replace(cache/member.name)
                seen.add(member.name);names.append(member.name)
        if names!=part['members']:
            raise ValueError('Archive member order mismatch')
    if seen!=set(expected):
        raise ValueError('Incomplete checkpoint')
    print(f'Restored {len(manifest["entries"])} verified PCM entries into {cache}')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['create','restore'])
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--checkpoint',type=Path,required=True)
    args=parser.parse_args()
    if args.action=='create':create(args.cache.resolve(),args.checkpoint.resolve())
    else:restore(args.checkpoint.resolve(),args.cache.resolve())
