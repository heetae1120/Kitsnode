// Isolated candidate only. No Worker route, bindings or production integration.
// A single Durable Object name coordinates all origins globally. Fixed windows
// have boundary bursts, can be exhausted by attackers and need operational tuning.
const STATE_KEY='fixed-window-v1';
function policy(env) {
 const limit=Number(env?.STRICT_SITE_LIMIT),seconds=Number(env?.STRICT_SITE_WINDOW_SECONDS);
 if (!Number.isSafeInteger(limit)||limit<1||limit>1000000||!Number.isSafeInteger(seconds)||seconds<1||seconds>3600) throw new Error('Invalid strict-limit policy');
 return {limit,seconds};
}
export class StrictSiteLimiterCandidate {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(request){
  // Never expose this class as an external route: bind internally only.
  if(request.method!=='POST'||new URL(request.url).pathname!=='/admit')return new Response(null,{status:404});
  try{
   const {limit,seconds}=policy(this.env);
   const now=Date.now(),size=seconds*1000;
   const allowed=await this.state.storage.transaction(async tx=>{
    let entry=await tx.get(STATE_KEY);
    if(entry!==undefined && (!entry || !Number.isSafeInteger(entry.start) || !Number.isSafeInteger(entry.count) || entry.count<0 || entry.limit!==limit || entry.seconds!==seconds)) throw new Error('Stored policy mismatch');
    // Do not reopen a bucket because the clock moves backwards.
    if(!entry || now>=entry.start+size) entry={start:now,count:0,limit,seconds};
    if(entry.count>=limit)return false;
    await tx.put(STATE_KEY,{...entry,count:entry.count+1});
    return true;
   });
   return Response.json({allowed},{status:200,headers:{'cache-control':'no-store'}});
  }catch{return Response.json({error:'unavailable'},{status:503,headers:{'cache-control':'no-store'}});}
 }
}
// Call after verified Cloudflare IP checks and before opening a DB connection.
// Timeout/errors fail closed; a timed-out admitted request may consume quota.
export async function checkStrictSiteLimit(namespace,{timeoutMs=1000}={}) {
 if(!namespace || typeof namespace.idFromName!=='function' || typeof namespace.get!=='function' || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>5000) throw new Error('Strict limiter unavailable');
 let timer;
 try{
  const stub=namespace.get(namespace.idFromName('kitsnode-auth-site-v1'));
  return await Promise.race([
   Promise.resolve().then(async()=>{
    const result=await stub.fetch('https://internal.invalid/admit',{method:'POST'});
    if(!result?.ok)throw new Error('Strict limiter unavailable');
    const body=await result.json();
    if(typeof body?.allowed!=='boolean')throw new Error('Invalid strict limiter response');
    return body.allowed;
   }),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Strict limiter timed out')),timeoutMs)})
  ]);
 } finally {clearTimeout(timer);}
}
