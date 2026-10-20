// Public voice catalogue. Provider credentials never belong in this module.
export const neuralVoices = [
  {id:'aoede', name:'Aoede', label:'Aoede · женский'},
  {id:'charon', name:'Charon', label:'Charon · мужской'},
  {id:'kore', name:'Kore', label:'Kore · женский'},
  {id:'puck', name:'Puck', label:'Puck · мужской'},
] as const;
export type SpeechConfig = {provider:'google'|'device'; ready:boolean; message:string};
export const initialSpeechConfig:SpeechConfig = {provider:'device',ready:false,message:'Проверяем настройки озвучки…'};
export const defaultVoice = (secondary=false) => secondary?'charon':'aoede';
export function speechMode(selection:string, config:SpeechConfig){
  if(selection.startsWith('device:'))return 'device';
  return selection.startsWith('cloud:')||config.provider==='google'?'google':'device';
}
export function speechLabel(selection:string, config:SpeechConfig){
  return speechMode(selection,config)==='google'?'Нейроозвучка · Google Chirp 3 HD':'Системный голос устройства';
}
