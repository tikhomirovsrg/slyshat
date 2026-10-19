import { NextResponse } from 'next/server';
import {appUrl,consumeFlow,exchangeCode,createSession,readCookie,FLOW_COOKIE,SESSION_COOKIE,SESSION_SECONDS,cookieOptions} from '../../../../../lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const url=new URL(request.url);let token='';let error='';
 try{
  const verifier=consumeFlow(url.searchParams.get('state')||'',readCookie(request,FLOW_COOKIE));
  if(!verifier)throw new Error('Invalid OAuth state');
  if(url.searchParams.has('error')){error='cancelled';}else{
   const code=url.searchParams.get('code');if(!code||code.length>2048)throw new Error('Missing code');
   token=createSession(await exchangeCode(code,verifier));
  }
 }catch{error='failed';}
 const res=NextResponse.redirect(appUrl()+(error?'/?auth_error='+error:'/'));
 res.headers.set('Cache-Control','no-store');res.cookies.set(FLOW_COOKIE,'',cookieOptions(0));
 if(token)res.cookies.set(SESSION_COOKIE,token,cookieOptions(SESSION_SECONDS));
 return res;
}
