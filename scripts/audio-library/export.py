"""Export individual MP3 stories from the published recordings. No synthesis."""
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();group=p.add_mutually_exclusive_group(required=True);group.add_argument('--id');group.add_argument('--all',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 source=json.loads((ROOT/'content/audio-library/series-v1.json').read_text());manifest=json.loads((ROOT/'public/audio/library/manifest.json').read_text());stories=[s for s in source['stories'] if a.all or s['id']==a.id]
 if not stories:p.error('Unknown story ID')
 a.output.mkdir(parents=True,exist_ok=True)
 for story in stories:
  target=a.output/(story['id']+'.mp3')
  if target.exists():raise FileExistsError(f'Refusing to overwrite {target}')
  temp=a.output/(story['id']+'.tmp.mp3');command=['ffmpeg','-hide_banner','-loglevel','error','-n'];inputs=[]
  for i,sid in enumerate(story['segments']):
   segment=manifest['segments'][sid];command+=['-ss',str(segment['start']),'-t',str(segment['end']-segment['start']),'-i',str(ROOT/'public/audio/library'/segment['file'])];inputs.append(f'[{i}:a]')
  command+=['-filter_complex',''.join(inputs)+f'concat=n={len(inputs)}:v=0:a=1[out]','-map','[out]','-codec:a','libmp3lame','-b:a','64k',str(temp)]
  subprocess.run(command,check=True);temp.replace(target)
  (a.output/(story['id']+'.txt')).write_text('\n\n'.join(source['segments'][sid]['text']+'\n'+source['segments'][sid]['ru'] for sid in story['segments'])+'\n')
  print(target,flush=True)
if __name__=='__main__':main()
