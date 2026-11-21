// ISOLATED CANDIDATE. No login token or password is received by the extension.
// Keep this object in a live controller context; its private key is non-exportable
// and is lost when that context ends. Production wiring/recovery is not provided.
const validRequest=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const validAccount=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const validViewer=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x)&&x!=='kitsnode';
const validDigest=x=>typeof x==='string'&&/^sha256:[a-f0-9]{64}$/.test(x);
const validVersion=x=>typeof x==='string'&&/^[A-Za-z0-9._-]{1,64}$/.test(x);
export const NAVER_POLICY_VERSION='nav-invite-2026-11-21-v1';
export const NAVER_POLICY_DIGEST='sha256:c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596';
export function validScope(x){return Boolean(x&&x.naverPolicyVersion===NAVER_POLICY_VERSION&&x.naverPolicyDigest===NAVER_POLICY_DIGEST&&validRequest(x.requestId)&&validRequest(x.consentId)&&validAccount(x.accountId)&&validViewer(x.viewerId)&&validDigest(x.consentDigest)&&validVersion(x.consentVersion)&&x.recipientId==='kitsnode'&&x.role==='OPERATIONS_VIEWER'&&x.autoPolicy===true);}
export function proofMessage(operation,scope){
 if(!['redeem','begin_send'].includes(operation)||!validScope(scope))throw Error('invalid_scope');
 return new TextEncoder().encode(JSON.stringify(['kitsnode-invite-proof-v1',operation,scope.requestId,scope.consentId,scope.accountId,scope.viewerId,scope.consentDigest,scope.consentVersion,scope.recipientId,scope.role,scope.autoPolicy,scope.naverPolicyVersion,scope.naverPolicyDigest]));
}
export function encodeSignature(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export function decodeSignature(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(text))throw Error('invalid_signature');const binary=atob(text.replaceAll('-','+').replaceAll('_','/')+'==');return Uint8Array.from(binary,x=>x.charCodeAt(0));}
export async function createConsentProof({consentId,accountId,viewerId,consentDigest,consentVersion,naverPolicyVersion=NAVER_POLICY_VERSION,naverPolicyDigest=NAVER_POLICY_DIGEST,cryptoApi=globalThis.crypto}={}){
 const requestId=cryptoApi?.randomUUID?.();
 const scope={requestId,consentId,accountId,viewerId,consentDigest,consentVersion,recipientId:'kitsnode',role:'OPERATIONS_VIEWER',autoPolicy:true,naverPolicyVersion,naverPolicyDigest};
 if(!validScope(scope)||!cryptoApi?.subtle)throw Error('invalid_scope');
 const keys=await cryptoApi.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const publicKey=await cryptoApi.subtle.exportKey('jwk',keys.publicKey);
 // Only public information crosses to the website/server. Never export privateKey.
 const request=Object.freeze({...scope,publicKey:Object.freeze(publicKey)});
 let state='new';
 async function signed(operation){return encodeSignature(await cryptoApi.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,proofMessage(operation,scope)));}
 return Object.freeze({
  request,
  async redeem(transport){
   if(state!=='new'||typeof transport!=='function')return false;state='redeeming';
   try{const reply=await transport({requestId,signature:await signed('redeem')});
    if(reply?.status!=='reserved'||!validScope(reply)||Object.keys(scope).some(k=>reply[k]!==scope[k])){state='blocked';return false;}
    state='reserved';return true;
   }catch{state='blocked';return false;}
  },
  async beginSend(transport){
   if(state!=='reserved'||typeof transport!=='function')return false;state='sending';
   try{const reply=await transport({requestId,signature:await signed('begin_send')});
    // A failed/ambiguous response must never be automatically retried.
    state='finished';return reply?.status==='begun'&&reply.requestId===requestId;
   }catch{state='finished';return false;}
  },
 });
}
