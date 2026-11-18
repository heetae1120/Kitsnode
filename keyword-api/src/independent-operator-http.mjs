import {createHash,createPublicKey,randomUUID} from 'node:crypto';
import {createOperatorAllowlist} from './operator-evidence.mjs';
import {readLimitedJson} from './limited-json.mjs';
import {createIndependentOperatorProofVerifier,operatorProofMessage} from './independent-operator-proof.mjs';

// TEST-ONLY composition. Never deploy alongside the worker or with its
// service_role key. The injected store/key registry must belong to a distinct
// verifier service and independently controlled least-privilege DB role.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(v);
const keyId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...k].sort().join(',');
const states=new Set(['claimed','uncertain','skipped']);
export function createIndependentOperatorHttp({authClient,operatorIds,origin,resolveKey,issueChallenge,lookupChallenge,commitVerified,verifySessionActive,verifyEvidence,allowRequest,now=Date.now,newId=randomUUID}={}){
 let parsed;try{parsed=new URL(origin)}catch{throw TypeError('invalid_origin')}
 if(parsed.protocol!=='https:'||parsed.origin!==origin||parsed.username||parsed.password)throw TypeError('invalid_origin');
 if(![resolveKey,issueChallenge,lookupChallenge,commitVerified,verifySessionActive,verifyEvidence,allowRequest,now,newId].every(f=>typeof f==='function'))throw TypeError('invalid_dependencies');
 if(typeof authClient?.auth?.getUser!=='function')throw TypeError('invalid_auth_client');
 const verifyUser=async token=>{try{const {data,error}=await authClient.auth.getUser(token),u=data?.user,confirmation=u?.confirmed_at??u?.email_confirmed_at??u?.phone_confirmed_at;if(error||!uuid(u?.id)||u.aud!=='authenticated'||u.is_anonymous!==false||u.deleted_at!=null||typeof confirmation!=='string'||!Number.isFinite(Date.parse(confirmation)))return null;if(u.banned_until!=null&&(!Number.isFinite(Date.parse(u.banned_until))||Date.parse(u.banned_until)>Date.now()))return null;return {id:u.id}}catch{return null}};
 const isOperator=createOperatorAllowlist(operatorIds);
 return Object.freeze({async handler(req){
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const out=(v,s)=>new Response(JSON.stringify(v),{status:s,headers});
  if(req.headers.get('origin')!==origin)return out({error:'origin_not_allowed'},403);
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const h=(req.headers.get('access-control-request-headers')||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||h.some(v=>!['authorization','content-type'].includes(v)))return out({error:'preflight_denied'},403);
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  const url=new URL(req.url);if(req.method!=='POST'||url.pathname!=='/api/independent-operator-proof'||url.search)return out({error:'not_found'},404);
  const match=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);if(!match)return out({error:'unauthenticated'},401);
  const user=await verifyUser(match[1]);if(!user)return out({error:'unauthenticated'},401);
  let sessionId,tokenExpiresAt;try{const parts=match[1].split('.');if(parts.length!==3||!parts.every(Boolean))return out({error:'unauthenticated'},401);const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));if(claims.sub!==user.id||!uuid(claims.session_id)||!Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.exp*1000)||claims.exp*1000<=now())return out({error:'unauthenticated'},401);sessionId=claims.session_id;tokenExpiresAt=claims.exp*1000;if(await verifySessionActive({sessionId,userId:user.id})!==true)return out({error:'unauthenticated'},401)}catch{return out({error:'unauthenticated'},401)}
  if(await isOperator(user.id)!==true)return out({error:'forbidden'},403);
  try{if(await allowRequest(user.id)!==true)return out({error:'rate_limited'},429)}catch{return out({error:'unavailable'},503)}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out({error:'invalid_input'},400);
  let body;try{body=await readLimitedJson(req,2048)}catch{return out({error:'invalid_input'},400)}
  try{
   if(exact(body,['action','operation','keyId','claimId','expectedState','caseRef','evidenceHash'])&&body.action==='challenge'&&body.operation==='resolve'&&keyId(body.keyId)&&uuid(body.claimId)&&states.has(body.expectedState)&&ref(body.caseRef)&&typeof body.evidenceHash==='string'&&/^[a-f0-9]{64}$/.test(body.evidenceHash)){
    if(await verifyEvidence({claimId:body.claimId,caseRef:body.caseRef,evidenceHash:body.evidenceHash})!==true)return out({error:'evidence_unverified'},409);
    const publicKey=await resolveKey({operatorId:user.id,keyId:body.keyId});if(typeof publicKey!=='string'||publicKey.length>4096)return out({error:'unavailable'},503);
    const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')return out({error:'unavailable'},503);
    const issuedAt=now(),id=newId();if(!Number.isSafeInteger(issuedAt)||!uuid(id))return out({error:'unavailable'},503);
    const challenge={id,operatorId:user.id,sessionId,keyId:body.keyId,keyFingerprint:createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex'),operation:body.operation,claimId:body.claimId,expectedState:body.expectedState,caseRef:body.caseRef,evidenceHash:body.evidenceHash,issuedAt,expiresAt:Math.min(issuedAt+300000,tokenExpiresAt)};
    const challengeDigest=createHash('sha256').update(operatorProofMessage(challenge)).digest('hex');
    if(await issueChallenge({challenge,challengeDigest})!==true)return out({error:'unavailable'},503);
    return out({challenge},201);
   }
   if(exact(body,['action','challengeId','signature'])&&body.action==='submit'&&uuid(body.challengeId)&&typeof body.signature==='string'){
    const verifyProof=createIndependentOperatorProofVerifier({resolveKey,lookupChallenge:async challengeId=>{const c=await lookupChallenge(challengeId);return c&&c.expiresAt<=tokenExpiresAt?c:null},now,commitVerified:async proof=>{
     const again=await verifyUser(match[1]);if(!again||again.id!==user.id||await isOperator(again.id)!==true||await verifySessionActive({sessionId,userId:user.id})!==true||await verifyEvidence({claimId:proof.claimId,caseRef:proof.caseRef,evidenceHash:proof.evidenceHash})!==true)return false;
     return commitVerified({...proof,sessionId});
    }});
    const ok=await verifyProof({verifiedUserId:user.id,verifiedSessionId:sessionId,challengeId:body.challengeId,signature:body.signature});
    return ok?out({status:'recorded',claimRetried:false},201):out({error:'proof_rejected'},409);
   }
   return out({error:'invalid_input'},400);
  }catch{return out({error:'unavailable'},503)}
 }});
}
