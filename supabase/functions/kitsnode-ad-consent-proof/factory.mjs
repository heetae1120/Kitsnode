// Independent proof endpoint: attests an invitation attempt, never ownership,
// connection approval, permission to read data, or permission to bid.
import {createActiveSessionVerifier} from '../kitsnode-ad-api/src/invite-active-session.mjs';
import {createSharedRateLimiter} from '../kitsnode-ad-api/src/shared-rate-limit.mjs';
import {createSupabaseInviteStore} from '../kitsnode-ad-consent-api/supabase-store.mjs';
import {createSupabaseProofStore} from '../kitsnode-ad-consent-api/supabase-proof-store-candidate.mjs';
import {createConsentProofServer} from '../kitsnode-ad-consent-api/consent-proof-server-candidate.mjs';
import {NAVER_POLICY_VERSION,NAVER_POLICY_DIGEST} from '../kitsnode-ad-consent-api/consent-proof-bridge.mjs';
import {createProofHttp} from '../kitsnode-ad-consent-api/proof-http-candidate.mjs';
export function createExecutionProofHandler({authClient,serviceClient,extensionId,consentVersion,consentDigest,cryptoApi=globalThis.crypto}) {
 if(!/^[a-p]{32}$/.test(extensionId||'')||!/^[A-Za-z0-9._-]{1,64}$/.test(consentVersion||'')||!/^[a-f0-9]{64}$/.test(consentDigest||''))throw Error('invalid_configuration');
 const consentStore=createSupabaseInviteStore(serviceClient),repository=createSupabaseProofStore(serviceClient);
 const verifySession=createActiveSessionVerifier({authClient,isActive:consentStore.isActive});
 const limiter=createSharedRateLimiter(serviceClient);
 const server=createConsentProofServer({authenticate:async token=>{const session=await verifySession(token);return session?{userId:session.id,sessionId:session.sessionId}:null;},readConsent:repository.readConsent,repository,cryptoApi,isCurrent:request=>request.consentVersion===consentVersion&&request.consentDigest===`sha256:${consentDigest}`});
 // Rate limit only after resolving an authenticated member or an existing
 // opaque request. Never create limiter rows for attacker-supplied IDs.
 const allowRequest=async({operation,requestId,bearer})=>{
  const principal=operation==='approve'?await verifySession(bearer):await repository.get(requestId);
  const userId=operation==='approve'?principal?.id:principal?.userId;
  return userId?await limiter(userId):false;
 };
 const handler=createProofHttp({server,siteOrigin:'https://heetae1120.github.io',extensionOrigin:`chrome-extension://${extensionId}`,allowRequest});
 return async req=>{
  const url=new URL(req.url),base='/kitsnode-ad-consent-proof';
  // Gateways can preserve or strip the public /functions/v1 prefix. Match
  // exactly either supported form; never accept arbitrary path prefixes.
  const path=url.pathname.startsWith(`/functions/v1${base}/`)?url.pathname.slice('/functions/v1'.length):url.pathname;
  if(path===`${base}/policy-confirm`){
   const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
   const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
   if(req.headers.get('origin')!=='https://heetae1120.github.io'||url.search)return reply(403,{error:'forbidden'});
   headers['Access-Control-Allow-Origin']='https://heetae1120.github.io';
   if(req.method==='OPTIONS'){
    const names=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    if(req.headers.get('access-control-request-method')!=='POST'||names.some(x=>!['authorization','content-type'].includes(x)))return reply(403,{error:'forbidden'});
    headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
   }
   if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
   const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];
   if(!token)return reply(401,{error:'unauthenticated'});
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(400,{error:'invalid_request'});
   try{
    const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let size=0,pieces=[];
    try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>4096)return reply(400,{error:'invalid_request'});pieces.push(r.value)}}finally{try{await reader.cancel()}catch{}reader.releaseLock()}
    const bytes=new Uint8Array(size);let offset=0;for(const part of pieces){bytes.set(part,offset);offset+=part.length}
    const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='consentId,naverPolicyDigest,naverPolicyVersion'||!/^[-0-9a-f]{36}$/i.test(body.consentId)||body.naverPolicyVersion!==NAVER_POLICY_VERSION||body.naverPolicyDigest!==NAVER_POLICY_DIGEST)return reply(400,{error:'invalid_request'});
    const principal=await verifySession(token);if(!principal)return reply(401,{error:'unauthenticated'});
    if(await limiter(principal.id)!==true)return reply(429,{error:'rate_limited'});
    const result=await serviceClient.rpc('kits_invite_policy_confirm',{p_consent:body.consentId,p_user:principal.id,p_session:principal.sessionId,p_version:body.naverPolicyVersion,p_digest:body.naverPolicyDigest.slice(7)});
    if(result.error)throw Error('unavailable');return result.data===true?reply(200,{status:'confirmed'}):reply(403,{error:'forbidden'});
   }catch{return reply(503,{error:'unavailable'})}
  }
  if(!path.startsWith(`${base}/proof/`))return new Response(null,{status:404});
  return handler(new Request(`https://internal.invalid${path.slice(base.length)}${url.search}`,req));
 };
}
