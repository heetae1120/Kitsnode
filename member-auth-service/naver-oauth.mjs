import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { genericOAuth } from 'better-auth/plugins';

// Workers does not support redirect:'error'. Manual redirects must never be
// followed because the request can contain provider credentials or a token.
const isProviderSuccess = response => response?.ok === true && response.type !== 'opaqueredirect' && response.redirected !== true && !(response.status >= 300 && response.status < 400);

// The caller MUST route every Naver callback through handle(). Better Auth's
// callback verifies and consumes state before invoking the public getToken hook.
// AsyncLocalStorage only carries that request's state; it does not validate it.
export function createNaverOAuth({ clientId, clientSecret, claimState, fetchImpl = fetch }) {
  if (!clientId || !clientSecret || typeof claimState !== 'function') throw new Error('Naver credentials and atomic state store required');
  const requestState = new AsyncLocalStorage();
  const plugin = genericOAuth({ config: [{
    providerId: 'naver', clientId, clientSecret,
    authorizationUrl: 'https://nid.naver.com/oauth2.0/authorize',
    tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    pkce: false,
    async getToken({ code, redirectURI }) {
      const state = requestState.getStore();
      if (!state || !code || !redirectURI) throw new Error('Missing callback state');
      // This hook is reached only after Better Auth validates state, cookie and
      // expiry. A store must atomically claim the hash across all callbacks;
      // a failed claim or store error must never fall through to token exchange.
      const digest = createHash('sha256').update(state).digest('hex');
      if (await claimState(digest) !== true) throw new Error('Callback state already used');
      const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, state, redirect_uri: redirectURI });
      const response = await fetchImpl('https://nid.naver.com/oauth2.0/token', { method: 'POST', body, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (!isProviderSuccess(response)) throw new Error('Naver token exchange failed');
      const data = await response.json();
      if (typeof data.access_token !== 'string' || !data.access_token || data.error) throw new Error('Naver token response invalid');
      return { accessToken: data.access_token, tokenType: data.token_type };
    },
    async getUserInfo(tokens) {
      const response = await fetchImpl('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${tokens.accessToken}` }, redirect: 'manual', signal: AbortSignal.timeout(10000) });
      if (!isProviderSuccess(response)) return null;
      const data = await response.json();
      const profile = data?.response;
      if (data?.resultcode !== '00' || typeof profile?.id !== 'string' || !profile.id || typeof profile.email !== 'string' || !profile.email) return null;
      return { id: profile.id, email: profile.email, name: profile.name || profile.nickname || '', emailVerified: false };
    }
  }] });

  async function handle(request, authHandler) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/auth/callback/naver') return authHandler(request);
    // Reject ambiguity and methods that could hide another state in a body.
    if (request.method !== 'GET' || url.searchParams.getAll('state').length !== 1 || !url.searchParams.get('state') || url.searchParams.getAll('code').length > 1) return new Response('Invalid callback', { status: 400, headers: { 'cache-control': 'no-store' } });
    return requestState.run(url.searchParams.get('state'), () => authHandler(request));
  }
  return { plugin, handle };
}
