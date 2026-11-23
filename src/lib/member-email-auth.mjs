import { MEMBER_TERMS_VERSION, MEMBER_PRIVACY_VERSION } from './member-consent.mjs';
// Isolated adapter. It has no project URL or keys and never logs credentials.
const ok = code => ({ok:true,code});
const fail = code => ({ok:false,code});
const emailValid = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const passwordValid = value => typeof value === 'string' && value.length >= 8 && value.length <= 72;

function validRedirect(value, origin) {
  try {
    const target = new URL(value), expected = new URL(origin);
    const local = ['localhost','127.0.0.1','[::1]'].includes(target.hostname);
    return (target.protocol === 'https:' || (target.protocol === 'http:' && local)) &&
      target.origin === expected.origin && !target.username && !target.password && !target.search && !target.hash &&
      !expected.username && !expected.password && expected.pathname === '/' && !expected.search && !expected.hash;
  } catch { return false; }
}

/** Construct with the Supabase client auth namespace; no project details are built in. */
export function createEmailAuthClient({auth, confirmationRedirectTo, recoveryRedirectTo, trustedOrigin, signupAllowed = false}) {
  if (!auth || !validRedirect(confirmationRedirectTo,trustedOrigin) || !validRedirect(recoveryRedirectTo,trustedOrigin)) throw new TypeError('invalid_auth_configuration');
  let recovery = false;
  const subscription = auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    else if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') recovery = false;
  });
  const run = async (call, success, failure = 'unavailable') => {
    try { const result = await call(); if (['over_email_send_rate_limit','over_request_rate_limit'].includes(result?.error?.code)) return fail('email_rate_limited'); return !result || result.error ? fail(failure) : ok(success); }
    catch { return fail('unavailable'); }
  };
  return {
    async signUp(email,password,evidence,draft) {
      // Defense in depth only: direct requests to the public Auth API bypass this.
      if (signupAllowed !== true) return fail('signup_disabled');
      if (!emailValid(email) || !passwordValid(password) || evidence?.termsAccepted !== true || evidence?.privacyAcknowledged !== true || evidence?.termsVersion !== MEMBER_TERMS_VERSION || evidence?.privacyVersion !== MEMBER_PRIVACY_VERSION) return fail('invalid_input');
      if(draft!==undefined && (!draft || typeof draft.username!=='string'||!/^[a-z0-9][a-z0-9_-]{3,19}$/.test(draft.username)||typeof draft.name!=='string'||draft.name.length<1||draft.name.length>100||/[\x00-\x1f\x7f]/.test(draft.name)||typeof draft.phone!=='string'||!/^01[016789][0-9]{7,8}$/.test(draft.phone.replace(/[ -]/g,''))||!/^[0-9 -]+$/.test(draft.phone)||typeof draft.company!=='string'||draft.company.length>100||/[\x00-\x1f\x7f]/.test(draft.company)||draft.ageConfirmed!==true))return fail('invalid_input');
      try {
        const data={kitsnode_consent:{termsVersion:evidence.termsVersion,privacyVersion:evidence.privacyVersion,termsAccepted:true,privacyAcknowledged:true}};
        if(draft)data.kitsnode_signup_draft={username:draft.username,name:draft.name,phone:draft.phone,company:draft.company,ageConfirmed:true};
        const result = await auth.signUp({email:email.trim(),password,options:{emailRedirectTo:confirmationRedirectTo,data}});
        if (result?.error) return fail(result.error.code === 'over_email_send_rate_limit' ? 'email_rate_limited' : 'unavailable');
        // A session here means project email confirmation is disabled: do not proceed.
        if (result?.data?.session) {
          await auth.signOut();
          return fail('confirmation_required');
        }
        if (!result?.data) return fail('unavailable');
        return ok('signup_requested');
      } catch { return fail('unavailable'); }
    },
    async verifySignupCode(email,token) {
      if (signupAllowed !== true) return fail('signup_disabled');
      if (!emailValid(email) || typeof token !== 'string' || !/^[0-9]{6,10}$/.test(token)) return fail('invalid_code');
      try {
        const result = await auth.verifyOtp({email:email.trim(),token,type:'email'});
        if (result?.error) return fail('invalid_code');
        const user = result?.data?.user;
        if (!result?.data?.session || !user?.email_confirmed_at || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
          if (result?.data?.session) await auth.signOut();
          return fail('invalid_code');
        }
        return ok('email_verified');
      } catch { return fail('unavailable'); }
    },
    async resendSignupCode(email) {
      if (signupAllowed !== true) return fail('signup_disabled');
      if (!emailValid(email)) return fail('invalid_input');
      return run(() => auth.resend({type:'signup',email:email.trim()}),'signup_code_resent');
    },
    async signIn(email,password) {
      if (!emailValid(email) || typeof password !== 'string' || password.length < 1 || password.length > 72) return fail('invalid_input');
      try {
        const result = await auth.signInWithPassword({email:email.trim(),password});
        if (result?.error) return fail(result.error.code === 'email_not_confirmed' ? 'requires_confirmation' : 'sign_in_failed');
        if (!result?.data?.session || !result.data.user?.email_confirmed_at) {
          if (result?.data?.session) await auth.signOut();
          return fail('requires_confirmation');
        }
        return ok('signed_in');
      } catch { return fail('unavailable'); }
    },
    async signOut() { recovery = false; return run(() => auth.signOut(),'signed_out'); },
    async requestPasswordReset(email) {
      if (!emailValid(email)) return fail('invalid_input');
      return run(() => auth.resetPasswordForEmail(email.trim(),{redirectTo:recoveryRedirectTo}),'reset_requested');
    },
    async updatePassword(password) {
      if (!passwordValid(password)) return fail('invalid_input');
      if (!recovery) return fail('recovery_required');
      const result = await run(() => auth.updateUser({password}),'password_updated');
      if (result.ok) recovery = false;
      return result;
    },
    dispose() { subscription?.data?.subscription?.unsubscribe(); recovery = false; },
  };
}
