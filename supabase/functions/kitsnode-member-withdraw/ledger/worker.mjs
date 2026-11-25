import {createLedger} from './ledger.mjs';
const reply=(body,status)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function sameSecret(a,b){const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
export function makeHandler(makeLedger=createLedger){return async function(request,env){
 try{
  if(request.method!=='POST')return reply({error:'not_found'},404);
  const url=new URL(request.url);if(!['/intent','/complete','/lookup','/pending','/retry-cursor','/set-retry-cursor'].includes(url.pathname)||url.search)return reply({error:'not_found'},404);
  if(typeof env.LEDGER_TOKEN!=='string'||env.LEDGER_TOKEN.length<43||!env.DB)return reply({error:'unavailable'},503);
  const header=request.headers.get('authorization')||'';
  if(header.length>256||!header.startsWith('Bearer ')||!(await sameSecret(header.slice(7),env.LEDGER_TOKEN)))return reply({error:'denied'},403);
  if(request.headers.get('content-type')!=='application/json')return reply({error:'invalid_request'},400);
  const raw=await request.text();if(raw.length>1024)return reply({error:'invalid_request'},400);
  const data=JSON.parse(raw);if(!data||Array.isArray(data)||typeof data!=='object')return reply({error:'invalid_request'},400);
  const allowed=url.pathname==='/intent'?['requestId','subjectId','actorId']:url.pathname==='/lookup'?['subjectId']:url.pathname==='/pending'?['limit','after']:url.pathname==='/retry-cursor'?[]:url.pathname==='/set-retry-cursor'?['cursor']:['requestId','subjectId'];
  if(Object.keys(data).length!==allowed.length||Object.keys(data).some(k=>!allowed.includes(k)))return reply({error:'invalid_request'},400);
  const ledger=makeLedger(env.DB);
  if(url.pathname==='/pending')return reply({ok:true,entries:await ledger.listPending(data)},200);
  if(url.pathname==='/retry-cursor')return reply({ok:true,cursor:await ledger.retryCursor()},200);
  if(url.pathname==='/set-retry-cursor')return reply({ok:true,cursor:await ledger.setRetryCursor(data)},200);
  const result=url.pathname==='/intent'?await ledger.record(data):url.pathname==='/lookup'?await ledger.findBySubject(data):await ledger.complete(data);
  if(url.pathname==='/lookup' && !result)return reply({ok:true,found:false},200);
  return reply({ok:true,found:true,requestId:result.request_id,subjectId:result.subject_id,actorId:result.actor_id,completed:result.completed_at!=null},200);
 }catch{return reply({error:'unavailable'},503)}
}}
export async function runScheduledRetry(env,fetchImpl=fetch){
 const url=new URL(env.MEMBER_RETRY_URL||'');
 if(url.origin!=='https://bjpguxwqxlsteektkhwf.supabase.co'||url.pathname!=='/functions/v1/kitsnode-member-withdraw-retry'||url.search||url.hash||url.username||url.password||typeof env.MEMBER_RETRY_TOKEN!=='string'||env.MEMBER_RETRY_TOKEN.length<43)throw Error('retry_not_configured');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{const result=await fetchImpl(url.href,{method:'POST',headers:{authorization:'Bearer '+env.MEMBER_RETRY_TOKEN,'user-agent':'KITSNODE-Withdrawal/1.0'},redirect:'error',cache:'no-store',signal:controller.signal});if(!result.ok)throw Error('retry_unavailable');}finally{clearTimeout(timer)}
}
export default {fetch:makeHandler(),scheduled(_event,env,ctx){ctx.waitUntil(runScheduledRetry(env))}};
