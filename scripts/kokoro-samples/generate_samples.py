import json,time,hashlib,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
import onnxruntime as rt
from kokoro_onnx import Kokoro

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
start=time.monotonic()
options=rt.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1;options.log_severity_level=3
session=rt.InferenceSession(str(ROOT/'kokoro-v1.0.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
model=Kokoro.from_session(session,str(ROOT/'voices-v1.0.bin'))
print('Model loaded',round(time.monotonic()-start,1),'seconds',flush=True)
voices={'it':('if_sara','im_nicola','it'),'en':('bf_emma','bm_george','en-gb')}
cache={};manifest=[]
def synth(text,voice,lang):
 key=(text,voice,lang)
 if key in cache:return cache[key]
 started=time.monotonic()
 samples,sr=model.create(text,voice=voice,lang=lang,speed=1.0)
 assert sr==24000 and len(samples)>2400 and np.isfinite(samples).all()
 peak=float(np.abs(samples).max());assert peak>0.005,'Silent output'
 if peak>0.98:samples=samples*(0.98/peak)
 cache[key]=samples
 print(voice,'chars',len(text),'audio',round(len(samples)/sr,1),'generation',round(time.monotonic()-started,1),flush=True)
 return samples

def save(filename,samples,items):
 # Small padding protects initial and final sounds in players.
 samples=np.concatenate([np.zeros(3600,dtype=np.float32),samples,np.zeros(6000,dtype=np.float32)])
 wav=OUT/(filename+'.wav');mp3=OUT/(filename+'.mp3')
 sf.write(wav,samples,24000,subtype='PCM_16')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-q:a','3',str(mp3)],check=True)
 wav.unlink()
 manifest.append({'file':mp3.name,'duration_seconds':round(len(samples)/24000,3),'sha256':hashlib.sha256(mp3.read_bytes()).hexdigest(),'segments':items})

for lang,file in [('it','sources/coffee-it.json'),('en','sources/coffee-en.json')]:
 episode=json.loads((ROOT/file).read_text())
 female,male,locale=voices[lang]
 for voice in (female,male):
  text=episode['opening'];samples=synth(text,voice,locale)
  save(f'{lang}-{voice}',samples,[{'text':text,'voice':voice,'translation':episode['openingRu']}])
 segments=[{'text':episode['opening'],'translation':episode['openingRu'],'voice':female}]
 node='start';visited=set()
 while node not in visited:
  visited.add(node);n=episode['nodes'][node]
  segments.append({'text':n['text'],'translation':n['ru'],'voice':female})
  if not n['choices']:break
  c=n['choices'][0];segments.append({'text':c['text'],'translation':c['label'],'voice':male});node=c['next']
 wave=[]
 for seg in segments:
  wave.extend([synth(seg['text'],seg['voice'],locale),np.zeros(8400,dtype=np.float32)])
 save(f'{lang}-coffee-dialogue',np.concatenate(wave),segments)
(OUT/'manifest.json').write_text(json.dumps({'model':'Kokoro-82M v1.0 / kokoro-onnx 0.6.1','model_license':'Apache-2.0','speed':1,'files':manifest},ensure_ascii=False,indent=2)+'\n')
print('DONE',len(manifest),'MP3 files, total seconds',sum(x['duration_seconds'] for x in manifest),'wall seconds',round(time.monotonic()-start,1),flush=True)
