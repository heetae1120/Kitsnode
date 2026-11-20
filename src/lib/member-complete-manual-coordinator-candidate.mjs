// Review-only orchestration candidate. It is not imported by the application.
// Existing consent uses an immutable session-bound client; see companion notes.
import {bindConsentToUser, createMemberConsent, MEMBER_TERMS_VERSION, MEMBER_PRIVACY_VERSION} from './member-consent.mjs';

const fail = code => ({ok:false,code});
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const validSession = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/\s/.test(value);

/**
 * createConsentClient({userId,sessionKey}) MUST produce a client bound to the
 * authenticated access token for this exact session, never a mutable shared
 * browser client. Its DB policies must enforce the deletion barrier.
 * verifyActiveSession must independently validate the current server session
 * and deletion state; completeManual must repeat these checks at the server/DB
 * boundary. None of these dependencies is implemented by this candidate.
 */
export function createManualCompletionCoordinatorCandidate({userId,sessionKey,currentSession,verifyActiveSession,createConsentClient,completeManual}) {
  if (!uuid(userId) || !validSession(sessionKey) || ![currentSession,verifyActiveSession,createConsentClient,completeManual].every(fn=>typeof fn==='function')) throw new TypeError('invalid_dependencies');
  let busy=false, completed=false;
  function isCurrent() {
    try {const session=currentSession();return session?.userId===userId && session?.sessionKey===sessionKey;}
    catch {return false;}
  }
  async function verified() {
    if (!isCurrent()) return false;
    try {return await verifyActiveSession({userId,sessionKey}) === true && isCurrent();}
    catch{return false;}
  }
  return {
    async complete(input) {
      if (!isCurrent()) return fail('session_changed');
      if (busy) return fail('busy');
      if (completed) return fail('already_completed');
      if (input?.termsAccepted !== true || input?.privacyAccepted !== true || input?.ageConfirmed !== true ||
          input?.termsVersion !== MEMBER_TERMS_VERSION || input?.privacyVersion !== MEMBER_PRIVACY_VERSION) return fail('invalid_input');
      // Freeze the data associated with the checked confirmation. Do not pass
      // caller-owned objects or unrelated fields across an asynchronous gap.
      const payload=Object.freeze({name:input.name,username:input.username,email:input.email,phone:input.phone,
        termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION});
      busy=true;
      try {
        if (!await verified()) return isCurrent() ? fail('verification_required') : fail('session_changed');
        let consent;
        try {
          const client=await createConsentClient({userId,sessionKey});
          if (!isCurrent()) return fail('session_changed');
          consent=createMemberConsent(client);
        } catch {return isCurrent() ? fail('consent_unavailable') : fail('session_changed');}
        // bindConsentToUser fails closed if the exact session changes while
        // accept() inserts or verifies the recorded current document versions.
        const accept=bindConsentToUser(consent,userId,()=>isCurrent()?userId:null);
        const accepted=await accept({termsAccepted:true,privacyAcknowledged:true,termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION});
        if (!accepted.ok) return accepted.code === 'session_changed' || !isCurrent() ? fail('session_changed') : fail('consent_unavailable');
        // Consent may have been recorded at this point even if completion fails.
        if (!await verified()) return isCurrent() ? fail('verification_required') : fail('session_changed');
        let result;
        try {result=await completeManual(payload);} catch {return isCurrent()?fail('completion_unconfirmed'):fail('session_changed');}
        if (!isCurrent()) return fail('session_changed');
        if (!result || typeof result.ok !== 'boolean' || typeof result.code !== 'string') return fail('completion_unconfirmed');
        if (result.ok && result.code==='profile_completed') {completed=true;return {ok:true,code:'profile_completed'};}
        if (!result.ok && ['username_taken','profile_exists','verification_required','consent_required','invalid_input','unavailable'].includes(result.code)) return fail(result.code);
        return fail('completion_unconfirmed');
      } finally {busy=false;}
    },
  };
}
