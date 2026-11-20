// Isolated composition candidate. Never imported by the real app: this module
// provides no production session coordinator, documents API or atomic DB API.
// It does not verify JWTs or establish consent. Those guarantees belong to the
// injected trusted server operations and DB transaction, not to browser code.
const fail = code => ({ok:false,code});
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const email = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const version = value => typeof value === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(value);
const hash = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const validReceipt = value => typeof value === 'string' && value.length > 0 && value.length <= 4096 && /^[A-Za-z0-9_.-]+$/.test(value);

function safeDocuments(result) {
  if (result?.ok !== true || !result.documents || !result.metadata || !validReceipt(result.receipt)) return null;
  const {terms,privacy,revision} = result.documents, m=result.metadata;
  if (!terms || !privacy || typeof terms.body !== 'string' || typeof privacy.body !== 'string' || !terms.body || !privacy.body ||
      terms.body.length > 200000 || privacy.body.length > 200000 || !version(terms.version) || !version(privacy.version) ||
      terms.version !== m.termsVersion || privacy.version !== m.privacyVersion || !hash(m.termsSha256) || !hash(m.privacySha256) ||
      !Number.isSafeInteger(revision) || revision < 1 || revision !== m.revision) return null;
  // The server must hash exact displayed UTF-8 bytes and verify the receipt;
  // this UI candidate checks shape only and cannot establish document trust.
  return Object.freeze({
    shown:Object.freeze({terms:Object.freeze({body:terms.body,version:terms.version}),privacy:Object.freeze({body:privacy.body,version:privacy.version}),revision}),
    metadata:Object.freeze({termsVersion:m.termsVersion,privacyVersion:m.privacyVersion,termsSha256:m.termsSha256,privacySha256:m.privacySha256,revision:m.revision}),
    receipt:result.receipt,
  });
}

/**
 * `session` must be a shared, trusted session coordinator: snapshot() returns
 * an immutable {userId,sessionKey,email,emailConfirmed}, and isCurrent(snapshot) synchronously
 * becomes false as soon as any login/logout/session change starts. Remote JWT
 * validation and session/consent/deletion checks remain mandatory on the server.
 * `documents.issue()` fetches a server-issued document snapshot for that session;
 * `atomic.complete()` MUST send the exact receipt+metadata to a server endpoint
 * backed by the reviewed atomic transaction. It must not call the older profile
 * endpoint. These dependencies are not supplied by the current product.
 */
export function createMemberOnboardingUiBridgeCandidate({enabled=false,environment,session,onboarding,documents,atomic}={}) {
  if (enabled !== true) return Object.freeze({enabled:false});
  // This candidate is intentionally restricted to synthetic test composition.
  if (environment !== 'synthetic' || !session || typeof session.snapshot !== 'function' || typeof session.isCurrent !== 'function' ||
      !onboarding || !['checkUsername','register','signIn','inspectDraft'].every(k=>typeof onboarding[k] === 'function') ||
      typeof documents?.issue !== 'function' || typeof atomic?.complete !== 'function') throw new TypeError('invalid_candidate_configuration');
  let context=null, sequence=0, completing=false;
  const current = snapshot => {try{return session.isCurrent(snapshot) === true;}catch{return false;}};
  const take = async () => {try{const s=await session.snapshot();return s && current(s) ? s:null;}catch{return null;}};
  const validIdentity = s => s && uuid(s.userId) && typeof s.sessionKey === 'string' && s.sessionKey.length>0 && s.sessionKey.length<=256 && !/\s/.test(s.sessionKey) && validEmail(s.email) && s.emailConfirmed === true;
  const unchanged = (s,n) => n===sequence && current(s);
  return Object.freeze({
    enabled:true,
    // Existing UI props can receive these explicit opt-in callbacks. This does
    // not activate them in MemberAuthPrep or change the legacy email flow.
    extendedSignup:Object.freeze({checkUsername:username=>onboarding.checkUsername(username),register:input=>onboarding.register(input)}),
    usernameSignIn:(username,password)=>onboarding.signIn(username,password),
    invalidate(){sequence++;context=null;},
    async resumeAfterEmailConfirmation() {
      const n=++sequence;context=null;
      const s=await take();if (!validIdentity(s)) return fail('verification_required');
      if (!unchanged(s,n)) return fail('session_changed');
      let draft;try{draft=await onboarding.inspectDraft();}catch{return fail('unavailable');}
      if(!unchanged(s,n))return fail('session_changed');
      if(!draft || (!draft.ok && draft.code!=='manual_completion_required')) return fail(draft?.code || 'unavailable');
      if(draft.ok && (draft.code!=='draft_ready' || !draft.fields || email(draft.fields.email)!==email(s.email) ||
         typeof draft.fields.name!=='string' || draft.fields.name.length>100 ||
         typeof draft.fields.username!=='string' || draft.fields.username.length>20 ||
         typeof draft.fields.phone!=='string' || draft.fields.phone.length>32)) return fail('verification_required');
      let issued;try{issued=safeDocuments(await documents.issue());}catch{return fail('documents_unavailable');}
      if(!unchanged(s,n))return fail('session_changed');
      if(!issued)return fail('documents_unavailable');
      context=Object.freeze({session:s,issued,sequence:n});
      const fields=draft.ok ? {name:draft.fields.name,username:draft.fields.username,phone:draft.fields.phone} : null;
      return {ok:true,code:draft.ok?'prefill_ready':'manual_completion_required',email:s.email,documents:issued.shown,fields};
    },
    async complete(input) {
      const active=context;
      if(!active || !unchanged(active.session,active.sequence))return fail('session_changed');
      if(completing)return fail('busy');
      const m=active.issued.metadata;
      if(!input || input.termsAccepted!==true || input.privacyAccepted!==true || input.ageConfirmed!==true ||
         input.termsVersion!==m.termsVersion || input.privacyVersion!==m.privacyVersion || email(input.email)!==email(active.session.email)) return fail('invalid_input');
      // Snapshot values so caller mutation cannot change the confirmed request.
      const payload=Object.freeze({name:input.name,username:input.username,phone:input.phone,email:active.session.email,termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:m.termsVersion,privacyVersion:m.privacyVersion});
      completing=true;
      try {
        let result;
        try{result=await atomic.complete({input:payload,documents:active.issued.metadata,receipt:active.issued.receipt});}
        catch{if(context===active)context=null;return unchanged(active.session,active.sequence)?fail('completion_unconfirmed'):fail('session_changed');}
        if(!unchanged(active.session,active.sequence))return fail('session_changed');
        if(!result || typeof result.ok!=='boolean' || typeof result.code!=='string'){if(context===active)context=null;return fail('completion_unconfirmed');}
        if(result.ok && result.code==='profile_completed'){context=null;return {ok:true,code:'profile_completed'};}
        if(!result.ok && ['document_changed','document_unverified','username_taken','profile_exists','verification_required','invalid_input','unavailable','completion_unconfirmed'].includes(result.code)) {
          if(['document_changed','document_unverified','verification_required','completion_unconfirmed'].includes(result.code) && context===active) context=null;
          return fail(result.code);
        }
        if(context===active)context=null;
        return fail('completion_unconfirmed');
      } finally {completing=false;}
    },
  });
}
