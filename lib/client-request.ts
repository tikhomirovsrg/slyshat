/** Browser fetch must keep its Window receiver, even when stored on a class.
 * AbortController also works on phones without AbortSignal.timeout().
 * Keep the deadline until the JSON body is read, and always release the timer.
 */
export async function requestJson<T>(request:typeof fetch,url:string,options:RequestInit={},timeoutMs=12000):Promise<{response:Response;data:T}>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await request.call(globalThis,url,{...options,signal:controller.signal});
  const data=await response.json() as T;
  return {response,data};
 }finally{clearTimeout(timer);}
}
