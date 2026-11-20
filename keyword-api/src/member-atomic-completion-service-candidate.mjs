// Isolated review-only boundary. No HTTP route, Supabase project or app import.
// Atomicity depends on the separately tested atomic DB function; an injected
// adapter cannot be trusted merely because it declares this contract string.
import {normalizeMemberUsername,validateMemberSignup} from '../../src/lib/member-signup-validation.mjs';

const CONTRACT='member-atomic-completion-v1';
const fail=code=>({ok:false,code});
const uuid=value=>typeof value==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const validToken=value=>typeof value==='string' && value.length>0 && value.length<=8192 && !/\s/.test(value);
const validVersion=value=>typeof value==='string' && /^[A-Za-z0-9._-]{1,64}$/.test(value);
const validHash=value=>typeof value==='string' && /^[0-9a-f]{64}$/.test(value);
const validRevision=value=>Number.isSafeInteger(value) && value>=1;
const validReceipt=value=>typeof value==='string' && value.length>=32 && value.length<=8192 && !/\s/.test(value);
const email=value=>typeof value==='string'?value.trim().toLowerCase():'';
function readDocumentMetadata(value) {
  if (!value || typeof value!=='object' || !validVersion(value.termsVersion) || !validVersion(value.privacyVersion) ||
      !validHash(value.termsSha256) || !validHash(value.privacySha256) || !validRevision(value.revision)) return null;
  return {termsVersion:value.termsVersion,privacyVersion:value.privacyVersion,termsSha256:value.termsSha256,privacySha256:value.privacySha256,revision:value.revision};
}
function sameDocuments(a,b) {
  return a.termsVersion===b.termsVersion && a.privacyVersion===b.privacyVersion && a.termsSha256===b.termsSha256 && a.privacySha256===b.privacySha256 && a.revision===b.revision;
}
/**
 * readActiveDocuments is a trusted central document metadata source.
 * verifySession validates the token remotely AND checks the active session;
 * verifyDocumentReceipt validates a short-lived trusted document-delivery
 * receipt, bound to this exact verified user, session and document metadata.
 * Merely echoing browser-provided hashes or a receipt-shaped value is unsafe.
 * atomicAdapter.complete MUST invoke only the session-bound transactional
 * atomic DB operation, rechecking session/deletion/document/consent/profile
 * inside the DB transaction. This candidate supplies none of those adapters.
 */
export function createAtomicCompletionServiceCandidate({readActiveDocuments,verifySession,verifyDocumentReceipt,atomicAdapter}) {
  if (typeof readActiveDocuments!=='function' || typeof verifySession!=='function' || typeof verifyDocumentReceipt!=='function' || !atomicAdapter ||
      atomicAdapter.contract!==CONTRACT || typeof atomicAdapter.complete!=='function') throw new TypeError('invalid_dependencies');
  return {
    async complete({token,input,documents,documentReceipt}) {
      if (!validToken(token)) return fail('verification_required');
      const submitted=readDocumentMetadata(documents);
      if (!submitted || !validReceipt(documentReceipt) || input?.termsAccepted!==true || input?.privacyAccepted!==true || input?.ageConfirmed!==true) return fail('invalid_input');
      // Do not silently replace the versions attached to the member's consent
      // inputs with a different caller-provided document snapshot.
      if (input.termsVersion!==submitted.termsVersion || input.privacyVersion!==submitted.privacyVersion) return fail('document_changed');
      // Snapshot all inputs before any asynchronous checks; caller mutation
      // must never alter which data or document was confirmed.
      const supplied={name:input.name,username:input.username,email:input.email,phone:input.phone,
        termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:submitted.termsVersion,privacyVersion:submitted.privacyVersion};
      const valid=validateMemberSignup({...supplied,password:'validation-only',passwordConfirmation:'validation-only'});
      if (!valid.valid) return fail('invalid_input');
      const profile=Object.freeze({username:normalizeMemberUsername(supplied.username),name:supplied.name.trim(),phone:supplied.phone.trim(),email:email(supplied.email)});
      let user;
      try {user=await verifySession(token);} catch {return fail('unavailable');}
      if (!user || !uuid(user.id) || user.emailConfirmed!==true || user.emailProvider!==true || !email(user.email) || email(user.email)!==profile.email) return fail('verification_required');
      try {
        if (await verifyDocumentReceipt({receipt:documentReceipt,token,userId:user.id,documents:Object.freeze({...submitted})}) !== true) return fail('document_unverified');
      } catch {return fail('unavailable');}
      let current;
      try {current=readDocumentMetadata(await readActiveDocuments());} catch {return fail('unavailable');}
      if (!current) return fail('unavailable');
      if (!sameDocuments(submitted,current)) return fail('document_changed');
      // Only the exact validated document snapshot and authenticated token are
      // forwarded; no caller-supplied subject or legacy profile function is used.
      let result;
      try {
        result=await atomicAdapter.complete({token,profile,documents:Object.freeze({...submitted}),termsAccepted:true,privacyAccepted:true,ageConfirmed:true});
      } catch {return fail('completion_unconfirmed');}
      if (result==='created' || result==='already_registered') return {ok:true,code:'profile_completed'};
      if (result==='unauthenticated' || result==='verification_required') return fail('verification_required');
      if (['document_changed','username_taken','profile_exists','consent_unavailable','invalid_input','unavailable'].includes(result)) return fail(result);
      // A malformed/ambiguous adapter response may follow a committed write.
      // Never automatically retry or report a definite failure in that case.
      return fail('completion_unconfirmed');
    },
  };
}
