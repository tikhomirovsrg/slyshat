import {getDb} from '../../../lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(){try{getDb().prepare('SELECT 1').get();return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503});}}
