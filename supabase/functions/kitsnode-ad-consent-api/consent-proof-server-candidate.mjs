// ISOLATED CANDIDATE: repository methods are security-critical transactions.
// Not an HTTP route, production adapter, or proof of Naver account ownership.
import {validScope,proofMessage,decodeSignature} from './consent-proof-bridge.mjs';
function validPublicKey(key){return key&&key.kty==='EC'&&key.crv==='P-256'&&typeof key.x==='string'&&typeof key.y==='string'&&/^[A-Za-z0-9_-]{43}$/.test(key.x)&&/^[A-Za-z0-9_-]{43}$/.test(key.y)&&key.d===undefined;}
export function createConsentProofServer({authenticate,readConsent,repository,cryptoApi=globalThis.crypto,now=Date.now,isCurrent=()=>true}={}){
 if(typeof authenticate!=='function'||typeof readConsent!=='function'||!repository||!['createAuthorized','get','transitionAuthorized'].every(name=>typeof repository[name]==='function')||!cryptoApi?.subtle||typeof isCurrent!=='function')throw Error('invalid_dependencies');
 async function approve({bearer,consentId,request}){
  if(!validScope(request)||isCurrent(request)!==true||consentId!==request.consentId||!validPublicKey(request.publicKey))return {status:'blocked'};
  const session=await authenticate(bearer);if(!session?.userId||!session?.sessionId)return {status:'blocked'};
  const consent=await readConsent({consentId,userId:session.userId,sessionId:session.sessionId,accountId:request.accountId});
  if(!consent||consent.consentId!==consentId||consent.userId!==session.userId||consent.sessionId!==session.sessionId||consent.accountId!==request.accountId||!Number.isFinite(consent.expiresAt)||consent.expiresAt<=now()||consent.consentDigest!==request.consentDigest||consent.consentVersion!==request.consentVersion||consent.autoPolicy!==true||consent.recipientId!=='kitsnode'||consent.role!=='OPERATIONS_VIEWER')return {status:'blocked'};
  // The browser's viewer ID is an assertion, not proof of identity or
  // account ownership. This only authorizes an attempt by the member.
  return await repository.createAuthorized({request,session,consent,expiresAt:Math.min(now()+600000,consent.expiresAt)})?{status:'approved'}:{status:'blocked'};
 }
 async function signedTransition(operation,{requestId,signature}){
  if(typeof requestId!=='string')return {status:'blocked'};
  const row=await repository.get(requestId);if(!row||!validScope(row.request)||isCurrent(row.request)!==true||!validPublicKey(row.request.publicKey))return {status:'blocked'};
  try{
   const publicKey=await cryptoApi.subtle.importKey('jwk',row.request.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   if(!await cryptoApi.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,decodeSignature(signature),proofMessage(operation,row.request)))return {status:'blocked'};
  }catch{return {status:'blocked'};}
  // Atomic transition MUST recheck row, proof key, session not revoked, exact
  // consent, membership and expiry; the read above alone is not authorization.
  const ok=await repository.transitionAuthorized({operation,expected:row,now:now()});if(!ok)return {status:'blocked'};
  if(operation==='begin_send')return {status:'begun',requestId};
  const {publicKey,...scope}=row.request;return {status:'reserved',...scope};
 }
 return Object.freeze({approve,redeem:input=>signedTransition('redeem',input),beginSend:input=>signedTransition('begin_send',input)});
}
