import {readLimitedJson} from './limited-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===[...keys].sort().join(',');

// Unmounted read-only performance endpoint. It only calls the authorized statistics
// service, never a provider writer or a scheduler. The server must supply
// authenticated sessions, per-user throttling and explicitly allowed origins.
export function createPerformanceHttp({allowedOrigins,verifySession,allowRequest,readPerformance}={}){
 if(!Array.isArray(allowedOrigins)||!allowedOrigins.length||!allowedOrigins.every(o=>{try{const u=new URL(o);return u.protocol==='https:'&&u.origin===o&&!u.username&&!u.password}catch{return false}})||![verifySession,allowRequest,readPerformance].every(f=>typeof f==='function'))throw TypeError('invalid_dependencies');
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const out=(x,status)=>new Response(JSON.stringify(x),{status,headers});
  if(!allowedOrigins.includes(origin))return out({error:'origin_not_allowed'},403);
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return out({error:'preflight_denied'},403);
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  const url=new URL(req.url);if(url.pathname!=='/api/performance'||url.search||req.method!=='POST')return out({error:'not_found'},404);
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];if(!token)return out({error:'unauthenticated'},401);
  try{const user=await verifySession(token);if(!uuid(user?.id))return out({error:'unauthenticated'},401);if(await allowRequest(user.id)!==true)return out({error:'rate_limited'},429)}catch{return out({error:'unavailable'},503)}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out({error:'invalid_input'},400);
  let body;try{body=await readLimitedJson(req,1024)}catch{return out({error:'invalid_input'},400)}
  if(!exact(body,['connectionId','kind','campaignId','groupId','targetId','since','until']))return out({error:'invalid_input'},400);
  try{const result=await readPerformance(token,body);if(!result||!['observed','no_data','unavailable'].includes(result.status))return out({error:'unavailable'},503);return out({result},200)}catch{return out({error:'unavailable'},503)}
 };
}
