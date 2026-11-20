// Local review candidate only: deliberately not attached to an HTTP route or
// Supabase project. Production adapters must provide the guarantees in README.
import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto';
import {normalizeMemberUsername, validateMemberSignup} from '../../src/lib/member-signup-validation.mjs';

const USERNAME = /^[a-z0-9][a-z0-9_-]{3,19}$/;
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const genericFailure = () => ({ok:false,code:'sign_in_failed'});
const unavailable = () => ({ok:false,code:'unavailable'});
const validKey = value => typeof value === 'string' && value.length >= 1 && value.length <= 256;

export function createSignupDraftCodec({key, now = Date.now, ttlMs = 24 * 60 * 60 * 1000}) {
  if (!Buffer.isBuffer(key) || key.length !== 32 || !Number.isInteger(ttlMs) || ttlMs < 60_000 || ttlMs > 86_400_000) throw new TypeError('invalid_draft_configuration');
  return {
    seal(fields) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from('kitsnode-signup-draft-v1'));
      const payload = Buffer.from(JSON.stringify({kind:'signup-v1', expires:now()+ttlMs, fields}));
      const encrypted = Buffer.concat([cipher.update(payload),cipher.final()]);
      return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
    },
    open(token) {
      try {
        if (typeof token !== 'string' || token.length < 40 || token.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
        const bytes = Buffer.from(token,'base64url');
        const decipher = createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
        decipher.setAAD(Buffer.from('kitsnode-signup-draft-v1'));
        decipher.setAuthTag(bytes.subarray(12,28));
        const record = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
        if (record?.kind !== 'signup-v1' || !Number.isSafeInteger(record.expires) || record.expires <= now() || record.expires > now()+ttlMs || !record.fields || typeof record.fields !== 'object') return null;
        return record.fields;
      } catch { return null; }
    },
  };
}

/** All dependencies are server-side. No dependency may log request bodies,
 * tokens, email addresses, credentials, or draft payloads. `limit.consume`
 * MUST be distributed, atomic, enforce independent per-client AND per-subject limits, and fail closed; `clientKey` is supplied by
 * trusted infrastructure, never taken from an unchecked forwarded header.
 * `auth.verifySession` must check token validity and active session revocation.
 * `profiles.complete` must atomically recheck current Auth email, confirmation,
 * member consent and withdrawal state with the profile's unique insert.
 */
export function createMemberOnboardingCandidate({auth,profiles,limit,codec,limitKey,termsVersion,privacyVersion}) {
  if (!auth || !profiles || !limit || !codec || !Buffer.isBuffer(limitKey) || limitKey.length < 32 || !validKey(termsVersion) || !validKey(privacyVersion)) throw new TypeError('invalid_dependencies');
  const hashed = (kind,value) => createHmac('sha256',limitKey).update(kind).update('\0').update(value).digest('hex');
  async function allowed(kind,clientKey,subject) {
    if (!validKey(clientKey)) return false;
    try { return await limit.consume({kind,client:hashed('client',clientKey),subject:hashed(kind,subject || '')}) === true; }
    catch {return false;}
  }
  function consentMatches(input) {
    return input?.termsAccepted === true && input?.privacyAccepted === true && input?.ageConfirmed === true && input?.termsVersion === termsVersion && input?.privacyVersion === privacyVersion;
  }
  async function verifiedUser(token,fields) {
    if (typeof token !== 'string' || token.length < 1 || token.length > 8192 || /\s/.test(token) || !fields || !validKey(fields.email)) return null;
    try {
      const user = await auth.verifySession(token);
      return user && validKey(user.id) && user.emailConfirmed === true && user.emailProvider === true && normalizedEmail(user.email) === normalizedEmail(fields.email) && (!('signupSubject' in fields) || user.id === fields.signupSubject) ? user : null;
    } catch {return null;}
  }
  return {
    async checkUsername({clientKey,username}) {
      const id = normalizeMemberUsername(username);
      if (!await allowed('username-availability',clientKey,id)) return unavailable();
      if (!USERNAME.test(id)) return {ok:false,code:'invalid_input'};
      try {
        const free = await profiles.isUsernameAvailable(id);
        return typeof free !== 'boolean' ? unavailable() : {ok:true,code:free?'available':'unavailable'};
      } catch {return unavailable();}
    },
    async register({clientKey,input}) {
      const email = normalizedEmail(input?.email);
      if (!await allowed('signup',clientKey,email)) return unavailable();
      const validation = validateMemberSignup(input);
      if (!validation.valid || !consentMatches(input)) return {ok:false,code:'invalid_input'};
      // No username reservation before email verification. No password in draft.
      const fields = {email,username:normalizeMemberUsername(input.username),name:input.name.trim(),phone:input.phone.trim(),termsVersion,privacyVersion};
      try {
        const result = await auth.signUp({email,password:input.password,evidence:{termsVersion,privacyVersion,termsAccepted:true,privacyAcknowledged:true}});
        // Duplicate email and new signup must both yield a uniform outcome.
        // Always attempt to revoke unexpected sessions even on partial errors.
        if (result?.session) {try {await auth.revokeSession(result.session);} catch {} return unavailable();}
        if (!result || result.accepted !== true || !validKey(result.userId)) return unavailable();
        // The Auth adapter obtains userId only from Supabase's signup response.
        // Supabase may return an obfuscated ID for an existing email: the user
        // can use the authenticated manual recovery path instead.
        const draft = codec.seal({...fields,signupSubject:result.userId});
        return {ok:true,code:'signup_requested',draft};
      } catch {return unavailable();}
    },
    async inspectDraft({clientKey,token,draft}) {
      if (!await allowed('signup-draft',clientKey,'draft')) return unavailable();
      const fields = codec.open(draft);
      const user = fields && validKey(fields.signupSubject) ? await verifiedUser(token,fields) : null;
      if (!user || fields.termsVersion !== termsVersion || fields.privacyVersion !== privacyVersion) return {ok:false,code:'verification_required'};
      // Only the verified owner sees prefill data. The browser must re-confirm
      // all required consent and must remove the opaque draft after completion.
      return {ok:true,code:'draft_ready',fields:{username:fields.username,name:fields.name,email:fields.email,phone:fields.phone}};
    },
    async complete({clientKey,token,draft,confirmation,replacementUsername}) {
      if (!await allowed('signup-completion',clientKey,'completion')) return unavailable();
      const fields = codec.open(draft);
      const user = fields && validKey(fields.signupSubject) ? await verifiedUser(token,fields) : null;
      if (!user || fields.termsVersion !== termsVersion || fields.privacyVersion !== privacyVersion) return {ok:false,code:'verification_required'};
      if (!consentMatches(confirmation)) return {ok:false,code:'invalid_input'};
      const username = replacementUsername === undefined ? fields.username : normalizeMemberUsername(replacementUsername);
      if (!USERNAME.test(username)) return {ok:false,code:'invalid_input'};
      try {
        const result = await profiles.complete({token,subject:user.id,expectedEmail:fields.email,username,name:fields.name,phone:fields.phone,ageConfirmed:true,termsVersion,privacyVersion});
        if (result === 'created' || result === 'already_registered') return {ok:true,code:'profile_completed'};
        if (result === 'username_taken') return {ok:false,code:'username_taken'};
        if (result === 'profile_exists') return {ok:false,code:'profile_exists'};
        if (result === 'consent_required') return {ok:false,code:'consent_required'};
        if (result === 'verification_required') return {ok:false,code:'verification_required'};
        return unavailable();
      } catch {return unavailable();}
    },
    // Recovery for email links opened on another device or expired/lost drafts.
    // Caller re-enters all information; no old unbound draft is accepted.
    async completeManual({clientKey,token,input}) {
      if (!await allowed('signup-manual-completion',clientKey,'completion')) return unavailable();
      const validation = validateMemberSignup({...input,password:'validation-only',passwordConfirmation:'validation-only'});
      if (!validation.valid || !consentMatches(input)) return {ok:false,code:'invalid_input'};
      const fields = {email:normalizedEmail(input.email)};
      const user = await verifiedUser(token,fields);
      if (!user) return {ok:false,code:'verification_required'};
      try {
        const result = await profiles.complete({token,subject:user.id,expectedEmail:fields.email,username:normalizeMemberUsername(input.username),name:input.name.trim(),phone:input.phone.trim(),ageConfirmed:true,termsVersion,privacyVersion});
        if (result === 'created' || result === 'already_registered') return {ok:true,code:'profile_completed'};
        if (result === 'username_taken') return {ok:false,code:'username_taken'};
        if (result === 'profile_exists') return {ok:false,code:'profile_exists'};
        if (result === 'consent_required') return {ok:false,code:'consent_required'};
        if (result === 'verification_required') return {ok:false,code:'verification_required'};
        return unavailable();
      } catch {return unavailable();}
    },
    async signIn({clientKey,username,password}) {
      const id = normalizeMemberUsername(username);
      if (!await allowed('sign-in',clientKey,id)) return unavailable();
      if (!USERNAME.test(id) || typeof password !== 'string' || password.length < 1 || password.length > 72) return genericFailure();
      let mapping;
      try {mapping = await profiles.resolveForPasswordLogin(id);} catch {return unavailable();}
      // Always call auth even for unknown usernames; the random non-deliverable
      // address prevents creating a predictable real account as a dummy target.
      const email = mapping && validKey(mapping.email) && validKey(mapping.subject) ? mapping.email : `no-${randomBytes(16).toString('hex')}@example.invalid`;
      let result;
      try {result = await auth.signInWithPassword({email,password});} catch {return genericFailure();}
      const user = result?.user, session = result?.session;
      const validIdentity = mapping && user && session && user.id === mapping.subject && user.emailConfirmed === true && normalizedEmail(user.email) === normalizedEmail(mapping.email);
      let access = false;
      if (validIdentity) {try {access = await profiles.memberAccessAllowed(user.id) === true;} catch {access = false;}}
      if (!validIdentity || !access) {
        if (session) {try {await auth.revokeSession(session);} catch {}}
        return genericFailure();
      }
      // Only Auth tokens, never server-resolved email or profile, leave service.
      if (typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') {try {await auth.revokeSession(session);} catch {} return genericFailure();}
      return {ok:true,code:'signed_in',session:{access_token:session.access_token,refresh_token:session.refresh_token}};
    },
  };
}
