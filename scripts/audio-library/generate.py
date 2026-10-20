"""Generate and validate shared MP3 recordings; resume from checked PCM cache.
No web services, credentials or paid APIs. Source and model hashes bind every clip.
"""
import argparse,concurrent.futures,hashlib,json,os,subprocess,time,tempfile
from pathlib import Path
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[2]
MODEL_SHA='beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a'
VOICES_SHA='bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d'
model=None

def digest(path):return hashlib.file_digest(open(path,'rb'),'sha256').hexdigest()
def initialise(model_path,voices_path,threads):
 global model
 import onnxruntime as rt
 from kokoro_onnx import Kokoro
 o=rt.SessionOptions();o.intra_op_num_threads=threads;o.inter_op_num_threads=1;o.log_severity_level=3
 session=rt.InferenceSession(model_path,sess_options=o,providers=['CPUExecutionProvider'])
 model=Kokoro.from_session(session,voices_path)
def render(job):
 key,segment,cache=job
 identity=json.dumps([MODEL_SHA,VOICES_SHA,segment['text'],segment['voice'],segment['language'],1.0],ensure_ascii=False)
 name=hashlib.sha256(identity.encode()).hexdigest();path=Path(cache)/(name+'.wav')
 if path.exists():
  samples,sr=sf.read(path,dtype='float32');validate(samples,sr)
 else:
  samples,sr=model.create(segment['text'],voice=segment['voice'],lang='it' if segment['language']=='it' else 'en-gb',speed=1.0)
  validate(samples,sr);peak=float(np.abs(samples).max())
  if peak>0.98:samples=samples*(0.98/peak)
  temp=path.with_suffix('.tmp.wav');sf.write(temp,samples,sr,subtype='PCM_16');temp.replace(path)
 return key,str(path),len(samples)
def validate(samples,sr):
 if sr!=24000 or samples.ndim!=1 or len(samples)<2400 or not np.isfinite(samples).all() or np.abs(samples).max()<0.005:raise ValueError('Invalid or silent audio')
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--model',type=Path,required=True);parser.add_argument('--voices',type=Path,required=True);parser.add_argument('--cache',type=Path,required=True);parser.add_argument('--workers',type=int,default=2);parser.add_argument('--threads',type=int,default=2);args=parser.parse_args()
 if not 1<=args.workers<=4 or not 1<=args.threads<=4:raise ValueError('Use 1–4 workers and threads')
 if digest(args.model)!=MODEL_SHA or digest(args.voices)!=VOICES_SHA:raise ValueError('Model/voice checksum mismatch')
 args.cache=args.cache.resolve();args.cache.mkdir(parents=True,exist_ok=True);os.environ['TMPDIR']=str(args.cache);tempfile.tempdir=str(args.cache)
 source_path=ROOT/'content/audio-library/series-v1.json';source=json.loads(source_path.read_text())
 out=ROOT/'public/audio/library';out.mkdir(parents=True,exist_ok=True)
 manifest=dict(formatVersion=1,releaseId=source['releaseId'],sourceSha256=digest(source_path),model='Kokoro-82M v1.0',modelSha256=MODEL_SHA,voicesSha256=VOICES_SHA,codec='mp3',sampleRate=24000,bitrate=64000,files={},segments={})
 started=time.monotonic();results={}
 with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers,initializer=initialise,initargs=(str(args.model),str(args.voices),args.threads)) as pool:
  jobs=[(k,s,str(args.cache)) for k,s in source['segments'].items()]
  futures=[pool.submit(render,j) for j in jobs]
  for n,future in enumerate(concurrent.futures.as_completed(futures),1):
   key,path,length=future.result();results[key]=(path,length)
   if n%5==0 or n==len(jobs):print(f'{n}/{len(jobs)} segments, {round(time.monotonic()-started)}s elapsed',flush=True)
 # Assemble audio sprites once, retaining exact PCM boundaries. 1s silence protects endings.
 for language in ['en','it']:
  for level in source['levels']:
   selected=[(k,s) for k,s in source['segments'].items() if s['language']==language and s['level']==level]
   filename=f'{language}-{level.lower()}-v1.mp3';cursor=0;parts=[]
   for key,segment in selected:
    data,sr=sf.read(results[key][0],dtype='float32');validate(data,sr)
    pad=np.zeros(24000,dtype=np.float32);parts.extend([data,pad])
    manifest['segments'][key]=dict(file=filename,start=round(cursor/24000,6),end=round((cursor+len(data)+6000)/24000,6),textSha256=segment['textSha256'],voice=segment['voice'])
    cursor+=len(data)+len(pad)
   # Pipes avoid cross-process hand-off of an unfinished large WAV. CBR supports
   # seekable playback; 1s guards and 250ms tails cover MP3 encoder padding.
   pcm=np.concatenate(parts).astype('<f4').tobytes();del parts
   encoded=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','f32le','-ar','24000','-ac','1','-i','pipe:0','-codec:a','libmp3lame','-b:a','64k','-write_xing','0','-f','mp3','pipe:1'],input=pcm,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
   decoded=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i','pipe:0','-f','f32le','-ac','1','-ar','24000','pipe:1'],input=encoded,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout
   samples=np.frombuffer(decoded,dtype='<f4');validate(samples,24000);duration=len(samples)/24000
   if abs(duration-cursor/24000)>=0.2:raise ValueError(f'Encoded duration mismatch: {filename}: {duration} vs {cursor/24000}')
   probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels','-of','json','pipe:0'],input=encoded,stdout=subprocess.PIPE,check=True).stdout)
   assert probe['streams'][0]['codec_name']=='mp3' and probe['streams'][0]['sample_rate']=='24000'
   temp=out/(filename+'.tmp.mp3');target=out/filename;temp.write_bytes(encoded)
   if digest(temp)!=hashlib.sha256(encoded).hexdigest():raise ValueError('Encoded file write mismatch')
   temp.replace(target)
   manifest['files'][filename]=dict(sha256=digest(target),bytes=target.stat().st_size,duration=duration)
   del pcm,encoded,decoded,samples
   print('Pack',filename,target.stat().st_size,'bytes',flush=True)
 manifest['readyStories']=sum(all(s in manifest['segments'] for s in story['segments']) for story in source['stories'])
 assert manifest['readyStories']==2000
 tmp=out/'manifest.json.tmp';tmp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');tmp.replace(out/'manifest.json')
 print('DONE',manifest['readyStories'],'playable variants,',sum(f['bytes'] for f in manifest['files'].values()),'audio bytes,',round(time.monotonic()-started),'seconds',flush=True)
if __name__=='__main__':main()
