// No automatic account linking. Explicit linking requires server-validated user.
export function createNaverAuth({auth, redirectTo, trustedOrigin, allowSignIn, allowLink}) {
  const target = new URL(redirectTo), origin = new URL(trustedOrigin);
  if (target.protocol !== 'https:' || target.origin !== origin.origin || target.username || target.password || target.search || target.hash || origin.pathname !== '/' || origin.search || origin.hash) throw new TypeError('invalid_redirect');
  async function start(method) {
    try {
      const result = await method({provider:'custom:naver', options:{redirectTo:target.href}});
      return result && !result.error ? {ok:true,code:'redirecting'} : {ok:false,code:'unavailable'};
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
        if (error || !user?.id || !user.email_confirmed_at || !Array.isArray(user.identities) || !user.identities.some(identity=>identity.provider === 'email')) return {ok:false,code:'unauthenticated'};
        return start(auth.linkIdentity.bind(auth));
      } catch { return {ok:false,code:'unavailable'}; }
    },
  };
}
