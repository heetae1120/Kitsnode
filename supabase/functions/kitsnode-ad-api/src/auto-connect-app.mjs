import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {createAutoConnectCandidate} from './auto-connect-candidate.mjs';
import {readLimitedJson} from './limited-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function createAutoConnectApp({authClient,serviceClient,resolveAccount,origin,pilotUser,pilotAccount}) {
 const verifySession=createSupabaseSessionVerifier(authClient),base=createSupabaseConnectionStore(serviceClient),memberAllowed=createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver',requireEmailProfile:true}),limit=createSharedRateLimiter(serviceClient);
 const store={getOwned:async args=>{const row=await base.getOwned(args);return row?.adAccountId===pilotAccount?row:null},approveVerified:async a=>{const r=await serviceClient.rpc('kits_ads_confirm_naver_access',{p_request_id:a.requestId,p_user_id:a.userId,p_ad_account_id:a.adAccountId,p_revision:a.expectedRevision,p_customer_id:a.customerId,p_naver_role:a.naverRole});if(r.error)throw Error('unavailable');return r.data===true;}};
 const check=createAutoConnectCandidate({verifySession,store,resolveAccount});
 return {handler:async req=>{
  const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};const out=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('origin')!==origin)return out(403,{error:'forbidden'});headers['access-control-allow-origin']=origin;
  if(req.method==='OPTIONS'){const h=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(req.headers.get('access-control-request-method')!=='POST'||h.some(x=>!['authorization','content-type'].includes(x)))return out(403,{error:'forbidden'});headers['access-control-allow-methods']='POST, OPTIONS';headers['access-control-allow-headers']='authorization, content-type';return new Response(null,{status:204,headers});}
  if(req.method!=='POST'||new URL(req.url).pathname!=='/api/auto-connect'||new URL(req.url).search)return out(404,{error:'not_found'});
  const m=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);if(!m)return out(401,{error:'unauthenticated'});
  const user=await verifySession(m[1]);if(!user)return out(401,{error:'unauthenticated'});
  if(!uuid(pilotUser)||user.id!==pilotUser||pilotAccount!=='2632357')return out(403,{error:'forbidden'});
  try{if(!await memberAllowed(user.id))return out(403,{error:'forbidden'});if(!await limit(user.id))return out(429,{error:'rate_limited'});}catch{return out(503,{error:'unavailable'});}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out(400,{error:'invalid_input'});
  let body;try{body=await readLimitedJson(req,1024);}catch{return out(400,{error:'invalid_input'});}
  if(!body||Object.keys(body).length!==1||!uuid(body.requestId))return out(400,{error:'invalid_input'});
  const result=await check(m[1],body.requestId);
  if(result.ok)return out(200,{status:result.status});
  if(result.code==='naver_access_unverified')return out(200,{status:'pending_review'});
  return out(result.code==='not_found'?404:result.code==='unauthenticated'?401:result.code==='conflict'?409:503,{error:result.code});
 }};
}
