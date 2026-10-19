import {NextResponse} from 'next/server';
import {sameOrigin,revokeSession,appUrl,SESSION_COOKIE,cookieOptions} from '../../../../lib/auth';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'origin'},{status:403});
 revokeSession(request);const res=NextResponse.redirect(appUrl(),303);res.cookies.set(SESSION_COOKIE,'',cookieOptions(0));res.headers.set('Cache-Control','no-store');return res;
}
