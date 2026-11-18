import {readLimitedJson} from './limited-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const exact=(o,expected)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===expected.sort().join(',');
const allowedResult=new Set(['unavailable','skipped','proposed','unchanged','illustrative']);

/** Local, opt-in HTTP factory for read-only simulations. It is not mounted or
 * deployed by importing this file. No operation can turn on a rule or send a
 * Naver write; referenceBid is a manual scenario, never a rank guarantee. */
export function createShoppingPreviewHttp({allowedOrigins,verifySession,allowRequest,preview,catalog,compare,shadow,rankEstimate}) {
 if(!Array.isArray(allowedOrigins)||!allowedOrigins.length||!allowedOrigins.every(o=>{try{const u=new URL(o);return u.protocol==='https:'&&u.origin===o&&!u.username&&!u.password}catch{return false}})||![verifySession,allowRequest,preview].every(f=>typeof f==='function'))throw TypeError('invalid_dependencies');
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const out=(body,status)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowedOrigins.includes(origin))return out({error:'origin_not_allowed'},403);
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return out({error:'preflight_denied'},403);
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  const url=new URL(req.url);if(!['/api/shopping-bid-preview','/api/shopping-catalog','/api/shopping-master-compare','/api/shopping-shadow','/api/shopping-rank-estimate'].includes(url.pathname)||url.search||req.method!=='POST')return out({error:'not_found'},404);
  const match=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);if(!match)return out({error:'unauthenticated'},401);
  let user;try{user=await verifySession(match[1]);if(!uuid(user?.id))return out({error:'unauthenticated'},401);if(await allowRequest(user.id)!==true)return out({error:'rate_limited'},429);}catch{return out({error:'unavailable'},503);}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out({error:'invalid_input'},400);
  let body;try{body=await readLimitedJson(req,1024)}catch{return out({error:'invalid_input'},400);}
  if(url.pathname==='/api/shopping-catalog'){
   if(typeof catalog!=='function')return out({error:'unavailable'},503);
   const catalogKeys={connections:['action'],campaigns:['action','connectionId'],groups:['action','connectionId','campaignId'],products:['action','connectionId','campaignId','groupId'],keywordCampaigns:['action','connectionId'],keywordGroups:['action','connectionId','campaignId'],keywords:['action','connectionId','campaignId','groupId']};
   if(typeof body?.action!=='string'||!Object.hasOwn(catalogKeys,body.action)||!exact(body,catalogKeys[body.action]))return out({error:'invalid_input'},400);
   try{const result=await catalog(match[1],body);if(!result?.ok)return out({error:result?.reason||'unavailable'},result?.reason==='unauthorized'?403:503);if(!Array.isArray(result.items)||result.items.length>(['products','keywords'].includes(body.action)?1000:500))return out({error:'too_many_results'},503);return out({items:result.items},200)}catch{return out({error:'unavailable'},503)}
  }
  if(url.pathname==='/api/shopping-master-compare'){
   if(typeof compare!=='function')return out({error:'unavailable'},503);
   if(!exact(body,['connectionId','campaignId','adgroupId']))return out({error:'invalid_input'},400);
   try{return out({result:await compare(match[1],body)},200)}catch{return out({error:'unavailable'},503)}
  }
  if(url.pathname==='/api/shopping-rank-estimate'){
   if(typeof rankEstimate!=='function')return out({error:'unavailable'},503);
   if(!exact(body,['connectionId','kind','campaignId','groupId','targetId','pcPosition','mobilePosition','maxBid']))return out({error:'invalid_input'},400);
   try{const result=await rankEstimate(match[1],body);if(!result||!['comparison_available','unavailable'].includes(result.status)||result.execution!=='disabled')return out({error:'unavailable'},503);return out({result},200)}catch{return out({error:'unavailable'},503)}
  }
  if(url.pathname==='/api/shopping-shadow'){
   if(typeof shadow!=='function')return out({error:'unavailable'},503);
   const actions={list:['action','connectionId'],save:['action','connectionId','campaignId','adgroupId','referenceBid','minBid','maxBid','maxChange','expectedVersion'],saveTarget:['action','connectionId','campaignId','adgroupId','targetType','targetId','referenceBid','minBid','maxBid','maxChange','expectedVersion'],saveRankTarget:['action','connectionId','campaignId','adgroupId','targetType','targetId','referenceBid','minBid','maxBid','maxChange','expectedVersion','pcPosition','mobilePosition'],saveSchedule:['action','connectionId','ruleId','expectedVersion','schedule'],simulate:['action','connectionId','ruleId'],history:['action','connectionId','ruleId']};
   if(typeof body?.action!=='string'||!Object.hasOwn(actions,body.action)||!exact(body,actions[body.action]))return out({error:'invalid_input'},400);
   try{const result=await shadow(match[1],body);if(!result?.ok)return out({error:result?.reason||'unavailable'},result?.reason==='unauthorized'?403:503);return out(result,200)}catch{return out({error:'unavailable'},503)}
  }
  const keys=['connectionId','campaignId','adgroupId','scope','referenceBid','minBid','maxBid','maxChange'];
  if(body?.scope==='product')keys.push('adId');
  if(!exact(body,keys))return out({error:'invalid_input'},400);
  try{const result=await preview(match[1],body);if(!result||!allowedResult.has(result.status))return out({error:'unavailable'},503);return out({result},200);}catch{return out({error:'unavailable'},503);}
 };
}
