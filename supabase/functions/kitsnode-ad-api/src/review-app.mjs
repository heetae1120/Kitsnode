import {randomUUID} from 'node:crypto';
import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createConnectionService} from './connection-service.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {createOperatorAllowlist} from './operator-evidence.mjs';
import {readLimitedJson} from './limited-json.mjs';

const uuid=v=>typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const exact=(o,keys)=>o && typeof o==='object' && !Array.isArray(o) && Object.keys(o).sort().join(',')===keys.sort().join(',');
const ref=v=>typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(v);
const methods=new Set(['advertiser_confirmation','contract_review']);

// The operator attests to a separately performed human verification. Evidence
// is a case reference, never an uploaded document or an automated identity proof.
export function createReviewApp({authClient,serviceClient,resolveAccount,operatorIds,origin='https://heetae1120.github.io',allowRequest}) {
 const verifySession=createSupabaseSessionVerifier(authClient);
 const verifyOperator=createOperatorAllowlist(operatorIds);
 const limit=allowRequest ?? createSharedRateLimiter(serviceClient);
 const store=createSupabaseConnectionStore(serviceClient);
 const rpc=async(name,args={})=>{const {data,error}=await serviceClient.rpc(name,args);if(error)throw Error('unavailable');return data;};
 const verifyOwnershipEvidence=async({requestId,evidenceRef})=>{
  if(!uuid(evidenceRef))return false;
  const rows=await rpc('kits_ads_evidence_list',{p_request_id:requestId});
  return Array.isArray(rows) && rows.some(e=>e.evidence_id===evidenceRef && !e.revoked_at && Number.isFinite(Date.parse(e.expires_at)) && Date.parse(e.expires_at)>Date.now());
 };
 const service=createConnectionService({verifySession,verifyOperator,verifyOwnershipEvidence,resolveAccount,store});
 return {handler:async req=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const out=(value,status)=>new Response(JSON.stringify(value),{status,headers});
  if(req.headers.get('origin')!==origin)return out({error:'origin_not_allowed'},403);
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return out({error:'preflight_denied'},403);
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  if(req.method!=='POST'||new URL(req.url).pathname!=='/api/ad-connection-reviews'||new URL(req.url).search)return out({error:'not_found'},404);
  const match=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);
  if(!match)return out({error:'unauthenticated'},401);
  const user=await verifySession(match[1]);
  if(!user)return out({error:'unauthenticated'},401);
  if(await verifyOperator(user.id)!==true)return out({error:'forbidden'},403);
  try {if(await limit(user.id)!==true)return out({error:'rate_limited'},429);}catch{return out({error:'unavailable'},503);}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out({error:'invalid_input'},400);
  let body;try {body=await readLimitedJson(req,1024);}catch{return out({error:'invalid_input'},400);}
  try {
   if(exact(body,['action']) && body.action==='queue') {
    const rows=await rpc('kits_ads_review_queue');if(!Array.isArray(rows)||rows.length>100)throw Error();
    return out({requests:rows},200);
   }
   if(exact(body,['action','requestId']) && body.action==='evidence' && uuid(body.requestId)){
    const rows=await rpc('kits_ads_evidence_list',{p_request_id:body.requestId});if(!Array.isArray(rows)||rows.length>100)throw Error();
    return out({evidence:rows},200);
   }
   if(exact(body,['action','requestId','method','caseRef','confirmed']) && body.action==='record' && uuid(body.requestId) && methods.has(body.method) && ref(body.caseRef) && body.confirmed===true){
    const evidenceId=randomUUID();const ok=await rpc('kits_ads_evidence_record',{p_id:evidenceId,p_request_id:body.requestId,p_operator_id:user.id,p_method:body.method,p_case_ref:body.caseRef});
    return ok===true?out({evidenceId},201):out({error:'conflict'},409);
   }
   if(exact(body,['action','requestId','evidenceId']) && body.action==='revoke' && uuid(body.requestId) && uuid(body.evidenceId)){
    const ok=await rpc('kits_ads_evidence_revoke',{p_request_id:body.requestId,p_evidence_id:body.evidenceId,p_operator_id:user.id});
    return ok===true?out({status:'revoked'},200):out({error:'conflict'},409);
   }
   if(exact(body,['action','requestId','evidenceId']) && body.action==='approve' && uuid(body.requestId) && uuid(body.evidenceId)){
    const result=await service.approve(match[1],body.requestId,body.evidenceId);
    return result.ok?out({status:result.status},200):out({error:result.code},result.code==='conflict'?409:result.code==='not_found'?404:result.code==='forbidden'?403:422);
   }
   return out({error:'invalid_input'},400);
  }catch{return out({error:'unavailable'},503);}
 }};
}
