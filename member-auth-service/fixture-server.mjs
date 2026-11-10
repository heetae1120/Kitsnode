// Isolated, deliberately non-production fixture. This process never uses a
// persistent database, SMTP, supplied credentials or non-loopback interfaces.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { createMemberAuth, createFixtureNaverAuth } from './auth.mjs';
import { createMemberApp, provisionConsentSchema } from './app.mjs';
import { createFixtureDocumentConsents } from './fixture-document-consents.mjs';

const authOrigin = 'http://127.0.0.1:4313';
const frontendOrigin = 'http://127.0.0.1:4312';
const documents = [
  { type: 'terms', version: 'local-terms-test-0.1', text: readFileSync(new URL('./fixture-service-terms.txt', import.meta.url), 'utf8') },
  { type: 'privacy', version: 'local-privacy-test-0.1', text: readFileSync(new URL('./fixture-privacy.txt', import.meta.url), 'utf8') },
];
// Legacy handler's gate is never used for the fixture's separated documents.
const syntheticTerms = { version: 'fixture-internal-only', text: 'Synthetic internal fixture gate' };

export async function createFixtureServer({ naverFixture = false } = {}) {
  const db = new DatabaseSync(':memory:');
  const mailbox = [];
  const options = {
    database: db, baseURL: authOrigin, secret: randomBytes(32).toString('hex'),
    trustedOrigins: [frontendOrigin],
    sendMail: async mail => {
      if (!/^[^@\s]+@example\.test$/i.test(mail.to)) throw new Error('Only example.test addresses are accepted');
      mailbox.push({ to: mail.to, kind: mail.kind, url: mail.url });
    }
  };
  // Never forward provider requests to a network. Only these two exact URLs
  // exist in the fixture; all other provider fetches fail closed.
  const fakeProviderFetch = async (input, init) => {
    if (input === 'https://nid.naver.com/oauth2.0/token') {
      const body = new URLSearchParams(init.body);
      if (body.get('code') !== 'fixture-naver-code' || !body.get('state')) return new Response(null, {status:400});
      return Response.json({access_token:'fixture-naver-access-token',token_type:'Bearer'});
    }
    if (input === 'https://openapi.naver.com/v1/nid/me' && new Headers(init.headers).get('authorization') === 'Bearer fixture-naver-access-token') return Response.json({resultcode:'00',response:{id:'fixture-naver-id',email:'naver-fixture@example.test',nickname:'Fixture'}});
    throw new Error('External requests are disabled in the Naver fixture');
  };
  const naver = naverFixture ? createFixtureNaverAuth({...options, fetchImpl:fakeProviderFetch}) : null;
  const auth = naver ? naver.auth : createMemberAuth(options);
  await (await getMigrations((await auth.$context).options)).runMigrations();
  provisionConsentSchema(db);
  const documentConsents = createFixtureDocumentConsents(db, documents);
  const authForApp = naver ? {...auth, handler:naver.handle} : auth;
  const app = createMemberApp({ auth:authForApp, database: db, terms: syntheticTerms, allowedOrigins: [frontendOrigin], naverCallbackURLs: naver ? [`${frontendOrigin}/store/login/`] : [] });
  const allow = new Set(['/api/auth/sign-up/email', '/api/auth/sign-in/email', '/api/auth/sign-out', '/api/auth/verify-email', '/api/auth/request-password-reset', '/api/auth/reset-password', '/api/member/terms', '/api/member/session', '/api/member/consent', '/api/member/private', '/api/member/verify-email']);
  if (naver) { allow.add('/api/auth/sign-in/social'); allow.add('/api/auth/callback/naver'); }
  const handler = async request => {
    const url = new URL(request.url);
    if (url.origin !== authOrigin) return new Response('Forbidden', {status:403});
    if (url.pathname === '/__fixture/mail') {
      if (request.method !== 'GET' || request.headers.get('origin') !== frontendOrigin) return new Response('Forbidden', {status:403});
      return Response.json(mailbox, {headers:{'access-control-allow-origin':frontendOrigin,'access-control-allow-credentials':'true','cache-control':'no-store','vary':'Origin'}});
    }
    if (url.pathname === '/__fixture/naver/authorize' && naver && request.method === 'GET') {
      const state = url.searchParams.get('state');
      if (!state || url.searchParams.getAll('state').length !== 1) return new Response('Invalid fixture state', {status:400});
      const callback = new URL('/api/auth/callback/naver', authOrigin);
      callback.searchParams.set('code','fixture-naver-code'); callback.searchParams.set('state',state);
      return Response.redirect(callback,302);
    }
    const resetLink = request.method === 'GET' && /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(url.pathname);
    if (!allow.has(url.pathname) && !resetLink) return new Response('Not found', {status:404});
    const origin = request.headers.get('origin');
    const corsHeaders = { 'access-control-allow-origin':frontendOrigin, 'access-control-allow-credentials':'true', 'cache-control':'no-store', 'vary':'Origin' };
    if (origin && origin !== frontendOrigin) return new Response('Forbidden', {status:403});
    if (url.pathname === '/api/member/terms' && request.method === 'GET') return Response.json({documents}, {headers:corsHeaders});
    if (url.pathname === '/api/member/consent' && request.method === 'POST') {
      if (origin !== frontendOrigin || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return Response.json({error:'forbidden'}, {status:403,headers:corsHeaders});
      let body;
      try { body = await request.json(); } catch { return Response.json({error:'invalid_request'}, {status:400,headers:corsHeaders}); }
      if (!body || Object.keys(body).join(',') !== 'consents' || !documentConsents.valid(body.consents, {requireAll:false})) return Response.json({error:'consent_failed'}, {status:400,headers:corsHeaders});
      let session;
      try { session = await auth.api.getSession({headers:request.headers}); } catch { return Response.json({error:'unavailable'}, {status:503,headers:corsHeaders}); }
      if (!session?.user?.id) return Response.json({error:'not_authorized'}, {status:401,headers:corsHeaders});
      try { documentConsents.record(session.user.id, body.consents); } catch { return Response.json({error:'unavailable'}, {status:503,headers:corsHeaders}); }
      return Response.json({ok:true}, {headers:corsHeaders});
    }
    if (url.pathname === '/api/member/private' && request.method === 'GET') {
      const session = await auth.api.getSession({headers:request.headers});
      const status = !session?.user?.id ? 401 : session.user.emailVerified === true && documentConsents.hasAccepted(session.user.id) ? 200 : 403;
      return Response.json(status === 200 ? {ok:true} : {error:'not_authorized'}, {status,headers:corsHeaders});
    }
    if (request.method === 'POST' && ['/api/auth/sign-up/email','/api/auth/sign-in/email','/api/auth/request-password-reset'].includes(url.pathname)) {
      try {
        const value = await request.clone().json();
        if (typeof value.email !== 'string' || !/^[^@\s]+@example\.test$/i.test(value.email)) return new Response('Fixture accounts must use example.test', {status:400});
      } catch { return new Response('Invalid request', {status:400}); }
    }
    if (url.pathname === '/api/auth/sign-up/email' && request.method === 'POST') {
      let body;
      try { body = await request.clone().json(); } catch { return new Response('Invalid request', {status:400,headers:corsHeaders}); }
      if (!documentConsents.valid(body.consents) || 'termsAccepted' in body || 'termsVersion' in body) return Response.json({error:'consent_required'}, {status:400,headers:corsHeaders});
      delete body.consents;
      body.termsAccepted = true;
      body.termsVersion = syntheticTerms.version;
      const headers = new Headers(request.headers); headers.delete('content-length');
      request = new Request(request.url, {method:'POST',headers,body:JSON.stringify(body)});
    }
    const response = await app(request);
    if (url.pathname === '/api/member/session' && request.method === 'GET' && response.ok) {
      const data = await response.json();
      const session = await auth.api.getSession({headers:request.headers});
      data.consentStatus = documentConsents.status(session?.user?.id);
      data.consented = !!session?.user?.id && documentConsents.hasAccepted(session.user.id);
      return Response.json(data, {headers:corsHeaders});
    }
    if (naver && url.pathname === '/api/auth/sign-in/social' && response.ok) {
      const data = await response.clone().json();
      const authorization = new URL(data.url);
      if (authorization.origin !== 'https://nid.naver.com' || authorization.pathname !== '/oauth2.0/authorize' || authorization.searchParams.get('redirect_uri') !== `${authOrigin}/api/auth/callback/naver` || !authorization.searchParams.get('state')) return new Response('Invalid fixture authorization', {status:502});
      const local = new URL('/__fixture/naver/authorize', authOrigin);
      local.searchParams.set('state',authorization.searchParams.get('state'));
      data.url = local.href;
      const headers = new Headers(response.headers); headers.delete('content-length');
      return Response.json(data, {status:response.status,headers});
    }
    return response;
  };
  const server = createServer(toNodeHandler(handler));
  return { server, db, handler };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.MEMBER_AUTH_FIXTURE !== '1' || process.env.NODE_ENV === 'production') throw new Error('Set MEMBER_AUTH_FIXTURE=1 outside production to start the local fixture');
  const { server, db } = await createFixtureServer({naverFixture:process.env.MEMBER_AUTH_FIXTURE_NAVER === '1'});
  server.listen(4313, '127.0.0.1', () => process.stdout.write('Synthetic member auth fixture: http://127.0.0.1:4313 (in-memory only)\n'));
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
