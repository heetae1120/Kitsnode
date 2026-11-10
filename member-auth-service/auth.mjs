import { betterAuth } from 'better-auth';
import { createNaverOAuth } from './naver-oauth.mjs';

// Provider credentials are needed only during profile lookup. Never persist
// them with an account, including on returning-login account updates.
const stripProviderTokens = async () => ({data:{accessToken:null, refreshToken:null, idToken:null, accessTokenExpiresAt:null, refreshTokenExpiresAt:null}});
const tokenPolicy = {
  databaseHooks: {account:{create:{before:stripProviderTokens},update:{before:stripProviderTokens}}},
  disabledPaths: ['/get-access-token', '/refresh-token', '/account-info']
};

// Process-local replay claims are only suitable for this isolated dev server.
// The pinned Better Auth state expires after 10 minutes; retain claims longer.
function createDevStateClaim() {
  const claims = new Map();
  return async digest => {
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) return false;
    const now = Date.now();
    for (const [key, expires] of claims) if (expires <= now) claims.delete(key);
    if (claims.has(digest) || claims.size >= 10000) return false;
    claims.set(digest, now + 15 * 60 * 1000);
    return true;
  };
}

// Internal foundation only: not exposed by an HTTP listener until terms enforcement,
// CSRF/origin and cross-site cookie behavior are reviewed end-to-end.
export function createMemberAuth({ database, baseURL, secret, trustedOrigins, sendMail, naver }) {
  if (!database || !baseURL || !secret || !Array.isArray(trustedOrigins) || typeof sendMail !== 'function') throw new Error('Incomplete auth configuration');
  if (naver) throw new Error('Naver provider disabled: token state compatibility is not verified');
  return betterAuth({
    database, baseURL, secret, trustedOrigins,
    ...tokenPolicy,
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, autoSignIn: false,
      sendResetPassword: async ({ user, url }) => sendMail({ to: user.email, kind: 'reset', url })
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => sendMail({ to: user.email, kind: 'verification', url })
    },
    account: { storeAccountCookie:false, encryptOAuthTokens:true, accountLinking: { enabled: true, disableImplicitLinking: true, trustedProviders: [] } },
    socialProviders: {},
    rateLimit: { enabled: true }
  });
}

// Synthetic integration only. Never accepts real provider credentials and never
// permits a non-loopback origin. Production createMemberAuth remains disabled.
export function createFixtureNaverAuth({ database, baseURL, secret, trustedOrigins, sendMail, fetchImpl }) {
  const isLoopbackOrigin = value => { try { const url = new URL(value); return url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.origin === value; } catch { return false; } };
  if (!isLoopbackOrigin(baseURL) || !Array.isArray(trustedOrigins) || !trustedOrigins.length || !trustedOrigins.every(isLoopbackOrigin)) throw new Error('Naver fixture requires a loopback origin');
  if (!database || !secret || typeof sendMail !== 'function' || typeof fetchImpl !== 'function') throw new Error('Incomplete fixture configuration');
  const naver = createNaverOAuth({clientId:'fixture-client', clientSecret:'fixture-secret', fetchImpl, claimState:createDevStateClaim()});
  const auth = betterAuth({ database, baseURL, secret, trustedOrigins,
    ...tokenPolicy,
    emailAndPassword: { enabled:true, requireEmailVerification:true, autoSignIn:false, sendResetPassword: async ({user,url}) => sendMail({to:user.email,kind:'reset',url}) },
    emailVerification: { sendOnSignUp:true, sendOnSignIn:true, sendVerificationEmail: async ({user,url}) => sendMail({to:user.email,kind:'verification',url}) },
    account: { storeAccountCookie:false, encryptOAuthTokens:true, accountLinking: { enabled:true, disableImplicitLinking:true, trustedProviders:[] } },
    plugins:[naver.plugin], rateLimit:{enabled:false}, logger:{disabled:true} });
  return { auth, handle: request => naver.handle(request, auth.handler) };
}

// Real-provider development is limited to one local process and an in-memory
// database supplied by its caller. It must not be used as a deployment server.
export function createDevNaverAuth({ database, baseURL, secret, trustedOrigins, sendMail, naver, fetchImpl = fetch }) {
  const allowed = new Set(['http://127.0.0.1:4312', 'http://127.0.0.1:4313', 'http://127.0.0.1:4323', 'http://127.0.0.1:4324']);
  if (process.env.NODE_ENV === 'production' || !['http://127.0.0.1:4313','http://127.0.0.1:4323'].includes(baseURL) || !Array.isArray(trustedOrigins) || trustedOrigins.length === 0 || !trustedOrigins.every(origin => allowed.has(origin))) throw new Error('Development auth is restricted to loopback');
  if (!database || typeof secret !== 'string' || secret.length < 32 || typeof sendMail !== 'function' || !naver?.clientId || !naver?.clientSecret || typeof fetchImpl !== 'function') throw new Error('Incomplete development auth configuration');
  const provider = createNaverOAuth({clientId:naver.clientId, clientSecret:naver.clientSecret, fetchImpl, claimState:createDevStateClaim()});
  const auth = betterAuth({database,baseURL,secret,trustedOrigins,...tokenPolicy,
    emailAndPassword:{enabled:true,requireEmailVerification:true,autoSignIn:false,sendResetPassword:async ({user,url}) => sendMail({to:user.email,kind:'reset',url})},
    emailVerification:{sendOnSignUp:true,sendVerificationEmail:async ({user,url}) => sendMail({to:user.email,kind:'verification',url})},
    account:{storeAccountCookie:false,encryptOAuthTokens:true,accountLinking:{enabled:true,disableImplicitLinking:true,trustedProviders:[]}},
    plugins:[provider.plugin], rateLimit:{enabled:true}});
  return {auth, handle:request => provider.handle(request, auth.handler)};
}

// Candidate factory: caller supplies durable DB and an atomic shared state claim.
// The returned handler MUST be used, including for every Naver callback.
export function createNaverMemberAuth({database, baseURL, secret, trustedOrigins, sendMail, naver, claimState, fetchImpl = fetch, cloudflareClientIP = false}) {
  const secureOrigin = value => { try { const u = new URL(value); return u.protocol === 'https:' && u.origin === value && !u.username && !u.password; } catch { return false; } };
  if (!database || !secureOrigin(baseURL) || typeof secret !== 'string' || secret.length < 32 || !Array.isArray(trustedOrigins) || !trustedOrigins.length || !trustedOrigins.every(secureOrigin) || typeof sendMail !== 'function' || !naver?.clientId || !naver?.clientSecret || typeof claimState !== 'function') throw new Error('Incomplete production auth configuration');
  const provider = createNaverOAuth({clientId:naver.clientId,clientSecret:naver.clientSecret,claimState,fetchImpl});
  const auth = betterAuth({database,baseURL,secret,trustedOrigins,...tokenPolicy,
    emailAndPassword:{enabled:true,requireEmailVerification:true,autoSignIn:false,sendResetPassword:async ({user,url})=>sendMail({to:user.email,kind:'reset',url})},
    emailVerification:{sendOnSignUp:true,sendOnSignIn:true,sendVerificationEmail:async ({user,url})=>sendMail({to:user.email,kind:'verification',url})},
    account:{storeAccountCookie:false,encryptOAuthTokens:true,accountLinking:{enabled:true,disableImplicitLinking:true,trustedProviders:[]}},
    plugins:[provider.plugin],rateLimit:{enabled:true},
    ...(cloudflareClientIP ? {advanced:{ipAddress:{ipAddressHeaders:['cf-connecting-ip']}}} : {})});
  return {auth,handle:request=>provider.handle(request,auth.handler)};
}
