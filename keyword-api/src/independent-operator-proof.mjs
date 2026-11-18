import {createHash,createPublicKey,verify} from 'node:crypto';

// Prototype only. Proofs must be verified by a separately deployed service
// with independently controlled operator keys and a database identity that
// is unavailable to the scheduler and its Supabase service_role credential.
// The caller supplies the identity only after an independent getUser check.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const ref=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(v);
const states=new Set(['claimed','uncertain','skipped']);
const keyid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const exact=(x,fields)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...fields].sort().join(',');
const fields=['id','operatorId','sessionId','keyId','keyFingerprint','operation','claimId','expectedState','caseRef','evidenceHash','issuedAt','expiresAt'];
const validChallenge=c=>exact(c,fields)&&uuid(c.id)&&uuid(c.operatorId)&&uuid(c.sessionId)&&keyid(c.keyId)&&typeof c.keyFingerprint==='string'&&/^[a-f0-9]{64}$/.test(c.keyFingerprint)&&['review','resolve'].includes(c.operation)&&uuid(c.claimId)&&states.has(c.expectedState)&&ref(c.caseRef)&&(c.operation==='review'?c.evidenceHash===null:typeof c.evidenceHash==='string'&&/^[a-f0-9]{64}$/.test(c.evidenceHash))&&Number.isSafeInteger(c.issuedAt)&&Number.isSafeInteger(c.expiresAt)&&c.expiresAt>c.issuedAt&&c.expiresAt-c.issuedAt<=300000;

// Protocol v1 uses a fixed JSON array so representation cannot depend on
// input object key order. Values come from the server's challenge store.
export function operatorProofMessage(challenge){
 if(!validChallenge(challenge))throw TypeError('invalid_challenge');
 return Buffer.from(JSON.stringify(['kits-shadow-operator-v1',challenge.id,challenge.operatorId,challenge.sessionId,challenge.keyId,challenge.keyFingerprint,challenge.operation,challenge.claimId,challenge.expectedState,challenge.caseRef,challenge.evidenceHash,challenge.issuedAt,challenge.expiresAt]),'utf8');
}

// lookupChallenge must return server-generated challenges. resolveKey reads
// only the separate service's trusted enrollment store (never request data).
// commitVerified must atomically check the bound challenge digest, expiry,
// unused status, current operator enrollment and claim state, then consume the
// challenge AND append the review in one DB transaction. It must return false
// on any race; this function never permits a retry or changes claim status.
export function createIndependentOperatorProofVerifier({lookupChallenge,resolveKey,commitVerified,now=Date.now}={}){
 if(![lookupChallenge,resolveKey,commitVerified,now].every(f=>typeof f==='function'))throw TypeError('invalid_dependencies');
 return async function verifyAndRecord({verifiedUserId,verifiedSessionId,challengeId,signature}={}){
  if(!uuid(verifiedUserId)||!uuid(verifiedSessionId)||!uuid(challengeId)||typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))return false;
  try{
   const c=await lookupChallenge(challengeId),time=now();
   if(!validChallenge(c)||c.id!==challengeId||c.operatorId!==verifiedUserId||c.sessionId!==verifiedSessionId||!Number.isSafeInteger(time)||time<c.issuedAt||time>=c.expiresAt)return false;
   const pem=await resolveKey({operatorId:c.operatorId,keyId:c.keyId});
   if(typeof pem!=='string'||pem.length>4096)return false;
   const key=createPublicKey(pem);if(key.asymmetricKeyType!=='ed25519')return false;
   const keyFingerprint=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');if(keyFingerprint!==c.keyFingerprint)return false;
   const bytes=Buffer.from(signature,'base64url');if(bytes.length!==64||bytes.toString('base64url')!==signature)return false;
   const message=operatorProofMessage(c);if(!verify(null,message,key,bytes))return false;
   const challengeDigest=createHash('sha256').update(message).digest('hex');
   return await commitVerified({challengeId:c.id,operatorId:c.operatorId,sessionId:c.sessionId,keyId:c.keyId,keyFingerprint,operation:c.operation,claimId:c.claimId,expectedState:c.expectedState,caseRef:c.caseRef,evidenceHash:c.evidenceHash,expiresAt:c.expiresAt,challengeDigest,signature})===true;
  }catch{return false}
 };
}
