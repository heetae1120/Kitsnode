// REVIEW ONLY — not an HTTP endpoint, not connected to the app or any DB.
// A JS preflight is NOT a receipt-expiry or consent-revocation guarantee.
// The trusted DB adapter must enforce the documented transaction boundary.
import {normalizeMemberUsername,validateMemberSignup} from '../../src/lib/member-signup-validation.mjs';
const fail=code=>({ok:false,code});
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const VER=/^[A-Za-z0-9._-]{1,64}$/;
const validToken=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&!/\s/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>=1;
const time=v=>Number.isSafeInteger(v)&&v>=0;
function metadata(v) {
 if(!v||typeof v!=='object'||typeof v.termsVersion!=='string'||!VER.test(v.termsVersion)||typeof v.privacyVersion!=='string'||!VER.test(v.privacyVersion)||typeof v.termsSha256!=='string'||!SHA.test(v.termsSha256)||typeof v.privacySha256!=='string'||!SHA.test(v.privacySha256)||!positive(v.revision))return null;
 return Object.freeze({termsVersion:v.termsVersion,privacyVersion:v.privacyVersion,termsSha256:v.termsSha256,privacySha256:v.privacySha256,revision:v.revision});
}
const sameDocs=(a,b)=>['termsVersion','privacyVersion','termsSha256','privacySha256','revision'].every(k=>a[k]===b[k]);
/**
 * verifySession(token) returns a server-verified subject, session and JWT expiry.
 * verifySignedReceipt({token,receipt}) verifies HMAC, active session binding,
 * doc metadata and consent generation server-side. It returns verified expiry,
 * nonce hash and generation, NEVER values taken on trust from request JSON.
 * readActiveDocuments reads authoritative current metadata from the server.
 * atomicAdapter.complete is a DB operation reachable only by a dedicated trusted
 * server role; it must atomically recheck subject/session/JWT and receipt expiry,
 * current docs, locked consent generation and one-time nonce use. All consent
 * withdrawal paths MUST bump that generation atomically before deleting consent.
 * Existing public/direct SQL and consent operations MUST be restricted separately.
 * This module supplies none of those concrete dependencies and MUST stay inert.
 */
export function createTrustedReceiptBoundaryCandidate({verifySession,verifySignedReceipt,readActiveDocuments,atomicAdapter,now=Date.now}) {
 if(![verifySession,verifySignedReceipt,readActiveDocuments,now].every(f=>typeof f==='function')||!atomicAdapter||atomicAdapter.contract!=='member-trusted-receipt-db-v1'||typeof atomicAdapter.complete!=='function')throw new TypeError('invalid_dependencies');
 return {async complete({token,receipt,input}={}) {
  if(!validToken(token))return fail('verification_required');
  if(typeof receipt!=='string'||receipt.length<32||receipt.length>4096||/\s/.test(receipt))return fail('document_unverified');
  if(!input||input.termsAccepted!==true||input.privacyAccepted!==true||input.ageConfirmed!==true)return fail('invalid_input');
  const data=Object.freeze({name:input.name,username:input.username,email:input.email,phone:input.phone,termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:input.termsVersion,privacyVersion:input.privacyVersion});
  if(!validateMemberSignup({...data,password:'validation-only',passwordConfirmation:'validation-only'}).valid)return fail('invalid_input');
  let session,verified,docs;
  try {session=await verifySession(token);}catch{return fail('unavailable');}
  if(!session||!UUID.test(session.id||'')||!UUID.test(session.sessionId||'')||!time(session.jwtExpiresMs)||session.emailConfirmed!==true||session.emailProvider!==true||typeof session.email!=='string'||session.email.trim().toLowerCase()!==String(data.email).trim().toLowerCase())return fail('verification_required');
  try {verified=await verifySignedReceipt({token,receipt});}catch{return fail('unavailable');}
  const signed=metadata(verified?.documents);
  if(!verified||!signed||verified.userId!==session.id||verified.sessionId!==session.sessionId||!positive(verified.generation)||typeof verified.nonceHash!=='string'||!SHA.test(verified.nonceHash)||!time(verified.issuedMs)||!time(verified.expiresMs)||verified.expiresMs<=verified.issuedMs||verified.expiresMs-verified.issuedMs>900000)return fail('document_unverified');
  if(data.termsVersion!==signed.termsVersion||data.privacyVersion!==signed.privacyVersion)return fail('document_changed');
  try {docs=metadata(await readActiveDocuments());}catch{return fail('unavailable');}
  if(!docs)return fail('unavailable');if(!sameDocs(signed,docs))return fail('document_changed');
  let t;try{t=now();}catch{return fail('unavailable');}
  if(!time(t))return fail('unavailable');
  if(verified.issuedMs>t||verified.expiresMs<=t||session.jwtExpiresMs<=t)return fail('verification_required');
  // Derived exclusively from trusted verifiers, never caller-provided expiry,
  // subject, generation or nonce. The DB must recheck at commit under its locks.
  const identity=Object.freeze({userId:session.id,sessionId:session.sessionId,jwtExpiresMs:session.jwtExpiresMs});
  const proof=Object.freeze({nonceHash:verified.nonceHash,generation:verified.generation,issuedMs:verified.issuedMs,expiresMs:verified.expiresMs,documents:signed});
  const profile=Object.freeze({username:normalizeMemberUsername(data.username),name:data.name.trim(),email:data.email.trim().toLowerCase(),phone:data.phone.trim()});
  let outcome;try{outcome=await atomicAdapter.complete({identity,proof,profile,termsAccepted:true,privacyAccepted:true,ageConfirmed:true});}catch{return fail('completion_unconfirmed');}
  if(outcome==='created'||outcome==='already_registered')return {ok:true,code:'profile_completed'};
  if(['verification_required','document_changed','consent_changed','username_taken','profile_exists','consent_unavailable','unavailable'].includes(outcome))return fail(outcome);
  return fail('completion_unconfirmed');
 }};
}
