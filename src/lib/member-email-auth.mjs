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
    try { const result = await call(); return !result || result.error ? fail(failure) : ok(success); }
    catch { return fail('unavailable'); }
  };
  return {
    async signUp(email,password) {
      // Defense in depth only: direct requests to the public Auth API bypass this.
      if (signupAllowed !== true) return fail('signup_disabled');
      if (!emailValid(email) || !passwordValid(password)) return fail('invalid_input');
      try {
        const result = await auth.signUp({email:email.trim(),password,options:{emailRedirectTo:confirmationRedirectTo}});
        if (result?.error) return fail('unavailable');
        // A session here means project email confirmation is disabled: do not proceed.
        if (result?.data?.session) {
          await auth.signOut();
          return fail('confirmation_required');
        }
        if (!result?.data) return fail('unavailable');
        return ok('signup_requested');
      } catch { return fail('unavailable'); }
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
