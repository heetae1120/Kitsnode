// Manual linking requires a server-validated existing email user. Provider-side
// automatic identity matching is a separate Supabase Auth policy.
export function naverIdentityState(user) {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return {
    linked: identities.some(identity => identity?.provider === 'custom:naver'),
    canLinkEmail: Boolean(user?.id && user.email_confirmed_at && identities.some(identity => identity?.provider === 'email')),
  };
}

// Do not display provider supplied error text or touch successful OAuth tokens.
export function oauthCallbackError(value) {
  let u;
  try { u = new URL(value); } catch { return null; }
  const hash = new URLSearchParams(u.hash.slice(1));
  if (hash.has('access_token') || hash.has('refresh_token') || u.searchParams.has('code')) return null;
  const params = hash.has('error') || hash.has('error_code') ? hash : u.searchParams;
  if (!params.has('error') && !params.has('error_code')) return null;
  const code = params.get('error_code') || params.get('error');
  if (code === 'identity_already_exists' || code === 'identity_already_linked') return 'identity_conflict';
  if (code === 'access_denied') return 'cancelled';
  return 'unavailable';
}

export function createNaverAuth({auth, redirectTo, trustedOrigin, allowSignIn, allowLink}) {
  const target = new URL(redirectTo), origin = new URL(trustedOrigin);
  if (target.protocol !== 'https:' || target.origin !== origin.origin || target.username || target.password || target.search || target.hash || origin.pathname !== '/' || origin.search || origin.hash) throw new TypeError('invalid_redirect');
  async function start(method) {
    try {
      const result = await method({provider:'custom:naver', options:{redirectTo:target.href}});
      if (result && !result.error) return {ok:true,code:'redirecting'};
      const code = result?.error?.code;
      return {ok:false,code:code === 'identity_already_exists' || code === 'identity_already_linked' ? 'identity_conflict' : 'unavailable'};
    } catch { return {ok:false,code:'unavailable'}; }
  }
  return {
    async signIn() {
      if (!allowSignIn) return {ok:false,code:'disabled'};
      // OAuth sign-in can create a new account; server-side policy and consent
      // must be ready before this optional button is enabled.
      return start(auth.signInWithOAuth.bind(auth));
    },
    async link() {
      if (!allowLink) return {ok:false,code:'disabled'};
      try {
        const {data,error} = await auth.getUser();
        const user = data?.user;
        if (error || !naverIdentityState(user).canLinkEmail) return {ok:false,code:'unauthenticated'};
        if (naverIdentityState(user).linked) return {ok:false,code:'already_linked'};
        return start(auth.linkIdentity.bind(auth));
      } catch { return {ok:false,code:'unavailable'}; }
    },
  };
}
