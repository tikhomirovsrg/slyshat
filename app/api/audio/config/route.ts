import {serverSpeechConfig} from '../../../../lib/speech-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(){return Response.json(serverSpeechConfig(),{headers:{'Cache-Control':'no-store'}});}
