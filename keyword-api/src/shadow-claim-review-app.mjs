import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createOperatorAllowlist} from './operator-evidence.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {readLimitedJson} from './limited-json.mjs';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const states=new Set(['claimed','uncertain','skipped']);
// Historical test-only prototype: the shared service role can forge operator
// identity, so never wire this handler to a deployment or browser route.
// A review records inspection only: it does not cancel, conclude or retry work.
export function createShadowClaimReviewApp({authClient,serviceClient,operatorIds,origin,allowRequest}={}){
 let parsed;try{parsed=new URL(origin)}catch{throw TypeError('invalid_origin')}
 if(parsed.protocol!=='https:'||parsed.origin!==origin||parsed.username||parsed.password)throw TypeError('invalid_origin');
 if(typeof serviceClient?.rpc!=='function')throw TypeError('invalid_client');
 const verifySession=createSupabaseSessionVerifier(authClient),verifyOperator=createOperatorAllowlist(operatorIds),limit=allowRequest??createSharedRateLimiter(serviceClient);
 if(typeof limit!=='function')throw TypeError('invalid_limiter');
 const rpc=async(name,args={})=>{const {data,error}=await serviceClient.rpc(name,args);if(error)throw Error('unavailable');return data};
 return {handler:async req=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const out=(body,status)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('origin')!==origin)return out({error:'origin_not_allowed'},403);
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(v=>!['authorization','content-type'].includes(v)))return out({error:'preflight_denied'},403);
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  const url=new URL(req.url);
  if(req.method!=='POST'||url.pathname!=='/api/shadow-claim-reviews'||url.search)return out({error:'not_found'},404);
  const match=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);if(!match)return out({error:'unauthenticated'},401);
  const user=await verifySession(match[1]);if(!user)return out({error:'unauthenticated'},401);
  if(await verifyOperator(user.id)!==true)return out({error:'forbidden'},403);
  try{if(await limit(user.id)!==true)return out({error:'rate_limited'},429)}catch{return out({error:'unavailable'},503)}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out({error:'invalid_input'},400);
  let body;try{body=await readLimitedJson(req,1024)}catch{return out({error:'invalid_input'},400)}
  try{
   if(exact(body,['action'])&&body.action==='queue'){
    const rows=await rpc('kits_shadow_claim_review_queue');if(!Array.isArray(rows)||rows.length>100)throw Error('unavailable');
    return out({claims:rows},200);
   }
   if(exact(body,['action','claimId','expectedState','caseRef','confirmed','acknowledgesMayStillComplete'])&&body.action==='record'&&uuid(body.claimId)&&states.has(body.expectedState)&&ref(body.caseRef)&&body.confirmed===true&&body.acknowledgesMayStillComplete===true){
    const ok=await rpc('kits_shadow_claim_review_record',{p_claim_id:body.claimId,p_expected_state:body.expectedState,p_operator_id:user.id,p_case_ref:body.caseRef});
    return ok===true?out({status:'review_recorded',claimStateChanged:false,retried:false,alarmCleared:false},201):out({error:'conflict'},409);
   }
   return out({error:'invalid_input'},400);
  }catch{return out({error:'unavailable'},503)}
 }};
}
