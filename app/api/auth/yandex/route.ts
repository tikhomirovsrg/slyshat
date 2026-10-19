import { NextResponse } from 'next/server';
import {appUrl,beginFlow,FLOW_COOKIE,cookieOptions} from '../../../../lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export function GET(){
 try{const flow=beginFlow();const res=NextResponse.redirect(flow.url);res.cookies.set(FLOW_COOKIE,flow.state,cookieOptions(600));res.headers.set('Cache-Control','no-store');return res;}
 catch{return NextResponse.redirect(appUrl()+'/?auth_error=unavailable');}
}
