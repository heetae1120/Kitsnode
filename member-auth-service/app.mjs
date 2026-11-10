import { createHash } from 'node:crypto';
import { createConsentGate } from './consent.mjs';
import { guardIdentityLink } from './link-guard.mjs';
import { createPostgresSupport } from './postgres-support.mjs';
import { createDocumentConsentStore, validDocumentSelections, validateDocuments } from './document-consents.mjs';

import {createDocumentConsentGate} from './document-consent-gate.mjs';

// Local integration handler. All values are supplied by the server, never the client.
function validateConfiguration({ auth, terms, allowedOrigins, naverCallbackURLs }) {
  if (!auth?.handler || !auth?.api || !terms?.version?.trim() || !terms?.text?.trim() || !Array.isArray(allowedOrigins) || !allowedOrigins.length) throw new Error('Member service configuration incomplete');
  for (const origin of allowedOrigins) { const url = new URL(origin); if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid origin'); }
  if (!Array.isArray(naverCallbackURLs) || naverCallbackURLs.some(value => { try { const url = new URL(value); return !allowedOrigins.includes(url.origin) || url.search !== '' || url.hash !== '' || url.username !== '' || url.password !== ''; } catch { return true; } })) throw new Error('Invalid Naver callback configuration');
}

// The existing SQLite adapter remains exclusively for isolated test fixtures.
export function createMemberApp({ auth, database, terms, allowedOrigins, naverCallbackURLs = [], emailAvailable = true }) {
  validateConfiguration({ auth, terms, allowedOrigins, naverCallbackURLs });
  if (!database?.prepare) throw new Error('SQLite fixture database required');
  const naverAvailable = naverCallbackURLs.length > 0;
  const digest = createHash('sha256').update(terms.text).digest('hex');
  database.prepare('INSERT OR IGNORE INTO member_terms (version, digest) VALUES (?, ?)').run(terms.version, digest);
  const existing = database.prepare('SELECT digest FROM member_terms WHERE version = ?').get(terms.version);
  if (!existing || existing.digest !== digest) throw new Error('Terms version already has different text');
  const store = {
    async hasAccepted({userId, version}) { return !!database.prepare('SELECT 1 FROM member_consents WHERE user_id = ? AND version = ?').get(userId, version); },
    async recordAcceptance({userId, version}) { database.prepare('INSERT OR IGNORE INTO member_consents (user_id, version, accepted_at) VALUES (?, ?, ?)').run(userId, version, new Date().toISOString()); }
  };
  return createMemberHandler({auth, terms, allowedOrigins, naverCallbackURLs, naverAvailable, emailAvailable, store});
}

// Explicitly opt-in runtime candidate. The supplied pool is never created here;
// migrations and server startup remain separate approval-gated operations.
export async function createPostgresMemberApp({ auth, pool, terms, documents, allowedOrigins, naverCallbackURLs = [], emailAvailable = false, accountLimit, naverIdentityLookup }) {
  if (documents) validateDocuments(documents);
  validateConfiguration({ auth, terms:documents ? documents[0] : terms, allowedOrigins, naverCallbackURLs });
  const store = documents ? createDocumentConsentStore(pool,documents) : createPostgresSupport(pool);
  if (documents) await store.register(); else await store.registerTerms(terms);
  // Identity derives from the verified session and the server-owned account table.
  // Require a single Naver-only identity when email is unverified: the session
  // schema does not record the provider used for a particular sign-in.
  const hasNaverIdentity = naverIdentityLookup ?? (async userId => {
    if (typeof userId !== 'string' || !userId || userId.length > 256) return false;
    const result=await pool.query(`SELECT 1 FROM member_auth.account a
      WHERE a."userId"=$1 AND a."providerId"='naver' AND length(a."accountId")>0
      AND NOT EXISTS (SELECT 1 FROM member_auth.account other WHERE other."userId"=$1 AND other."providerId"<>'naver') LIMIT 1`,[userId]);
    return result.rows.length===1;
  });
  return createMemberHandler({auth, terms, documents, allowedOrigins, naverCallbackURLs, naverAvailable: naverCallbackURLs.length > 0, emailAvailable, store, requireVerifiedEmail: true, accountLimit, hasNaverIdentity});
}

function createMemberHandler({auth, terms, documents, allowedOrigins, naverCallbackURLs, naverAvailable, emailAvailable, store, requireVerifiedEmail = false, accountLimit, hasNaverIdentity}) {
  const gate = documents ? createDocumentConsentGate({auth,store,documents,allowedOrigins}) : createConsentGate({ auth, store, terms, allowedOrigins });
  const emailVerificationAvailable = !!emailAvailable && naverCallbackURLs.length > 0 && (!requireVerifiedEmail || typeof accountLimit === 'function');
  const canUseMember = async session => !!session?.user?.id && (!requireVerifiedEmail || session.user.emailVerified === true || (typeof hasNaverIdentity === 'function' && (await hasNaverIdentity(session.user.id)) === true));
  const json = (value, status = 200) => Response.json(value, {status, headers: {'cache-control': 'no-store'}});
  return async function handle(request) {
    const origin = request.headers.get('origin');
    const cors = origin && allowedOrigins.includes(origin) ? origin : null;
    if (origin && !cors) return json({error:'origin_not_allowed'}, 403);
    const headers = new Headers({'vary':'Origin', 'cache-control':'no-store'});
    if (cors) { headers.set('access-control-allow-origin', cors); headers.set('access-control-allow-credentials','true'); }
    const withHeaders = response => { for (const [key,value] of headers) response.headers.set(key,value); return response; };
    const path = new URL(request.url).pathname;
    let response;
    if (request.method === 'OPTIONS') {
      if (!cors || !['GET','POST'].includes(request.headers.get('access-control-request-method'))) return json({error:'origin_not_allowed'},403);
      headers.set('access-control-allow-methods','GET, POST, OPTIONS');
      headers.set('access-control-allow-headers','content-type');
      return new Response(null,{status:204,headers});
    }
    // Account identity is taken only from a server-validated session, never a
    // user-supplied email, ID, OAuth parameter or unverified cookie value.
    if (accountLimit && ['/api/member/session','/api/member/consent','/api/member/private','/api/member/verify-email'].includes(path)) {
      try {
        const session=await auth.api.getSession({headers:request.headers});
        if (session?.user?.id && !await accountLimit(session.user.id)) return withHeaders(json({error:'rate_limited'},429));
      } catch { return withHeaders(json({error:'unavailable'},503)); }
    }
    if (path.startsWith('/api/auth/')) {
      if (path.includes('%') || path.includes('//') || path.endsWith('/')) return withHeaders(json({error:'invalid_path'},400));
      if (!['GET','HEAD'].includes(request.method) && !cors) return json({error:'origin_required'},403);
      const allowedAuth = (request.method === 'POST' && ['/api/auth/sign-up/email','/api/auth/sign-in/email','/api/auth/sign-out','/api/auth/request-password-reset','/api/auth/reset-password','/api/auth/sign-in/social'].includes(path)) ||
        (request.method === 'GET' && (path === '/api/auth/verify-email' || /^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(path) || (naverAvailable && path === '/api/auth/callback/naver')));
      if (!allowedAuth) return withHeaders(json({error:'not_found'},404));
      if (!emailAvailable && (['/api/auth/sign-up/email','/api/auth/sign-in/email','/api/auth/request-password-reset','/api/auth/reset-password','/api/auth/verify-email'].includes(path) || path.startsWith('/api/auth/reset-password/'))) return withHeaders(json({error:'not_found'},404));
      if (path === '/api/auth/sign-in/social') {
        if (!naverAvailable) return withHeaders(json({error:'not_found'},404));
        const blocked = await guardIdentityLink(request, auth);
        if (blocked) return withHeaders(blocked);
        let body;
        try { body = await request.clone().json(); } catch { return withHeaders(json({error:'invalid_request'},400)); }
        if (!naverCallbackURLs.includes(body.callbackURL)) return withHeaders(json({error:'invalid_callback'},400));
      }
      if (path === '/api/auth/sign-up/email' && request.method === 'POST') {
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return withHeaders(json({error:'invalid_signup'},400));
        let signup;
        try {
          const text = await request.text();
          if (new TextEncoder().encode(text).length > 16384) return withHeaders(json({error:'invalid_signup'},400));
          signup = JSON.parse(text);
        } catch { return withHeaders(json({error:'invalid_signup'},400)); }
        if (!signup || typeof signup !== 'object' || Array.isArray(signup) || (documents ? (!validDocumentSelections(signup.consents,documents,{requireAll:true}) || 'termsAccepted' in signup || 'termsVersion' in signup) : (signup.termsAccepted !== true || signup.termsVersion !== terms.version))) return withHeaders(json({error:'terms_required'},400));
        delete signup.consents; delete signup.termsAccepted; delete signup.termsVersion;
        const authHeaders = new Headers(request.headers); authHeaders.delete('content-length');
        request = new Request(request.url, {method:'POST',headers:authHeaders,body:JSON.stringify(signup)});
      }
      if (documents && path === '/api/auth/sign-up/email') {
        try { response = await store.withCurrent(() => auth.handler(request), {signup:true}); }
        catch { response = json({error:'unavailable'},503); }
      } else response = await auth.handler(request);
    } else if (path === '/api/member/terms' && request.method === 'GET') {
      if (documents) {
        try { response = await store.withCurrent(() => json({documents})); }
        catch { response = json({error:'unavailable'},503); }
      } else response = json({version:terms.version,text:terms.text});
    }
    else if (path === '/api/member/verify-email' && request.method === 'POST') {
      if (!emailVerificationAvailable || !cors || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return withHeaders(json({error:'unavailable'},503));
      let body, session;
      try {
        const raw=await request.text(); if (new TextEncoder().encode(raw).length > 1024) throw new Error('invalid');
        body=JSON.parse(raw); session=await auth.api.getSession({headers:request.headers});
      } catch { return withHeaders(json({error:'invalid_request'},400)); }
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) return withHeaders(json({error:'invalid_request'},400));
      if (!session?.user?.id || typeof session.user.email !== 'string' || !session.user.email) return withHeaders(json({error:'not_authorized'},401));
      if (session.user.emailVerified === true) return withHeaders(json({ok:true},200));
      const url=new URL(request.url); url.pathname='/api/auth/send-verification-email'; url.search='';
      const authHeaders=new Headers(request.headers); authHeaders.delete('content-length');
      try {
        const result=await auth.handler(new Request(url, {method:'POST',headers:authHeaders,body:JSON.stringify({email:session.user.email,callbackURL:naverCallbackURLs[0]})}));
        response=result.ok ? json({ok:true}) : json({error:'unavailable'},503);
      } catch { response=json({error:'unavailable'},503); }
    }
    else if (path === '/api/member/consent' && request.method === 'POST') {
      const result = await gate.accept(request); response = json(result.ok ? {ok:true} : {error:'consent_failed'},result.status);
    } else if (path === '/api/member/session' && request.method === 'GET') {
      const session = await auth.api.getSession({headers:request.headers});
      if (!session?.user?.id) response = json({authenticated:false,consented:false,memberAccess:false,naverAvailable,emailAvailable,emailVerified:false,emailVerificationAvailable,...(documents ? {consentStatus:{terms:false,privacy:false}} : {})});
      else { try { const result = await gate.authorize(request); const memberAccess=await canUseMember(session); response = result.status === 503 ? json({error:'unavailable'},503) : json({authenticated:true,consented:result.ok,memberAccess,naverAvailable,emailAvailable,emailVerified:session.user.emailVerified === true,emailVerificationAvailable,...(documents ? {consentStatus:result.consentStatus} : {})}); } catch {response=json({error:'unavailable'},503);} }
    } else if (path === '/api/member/private' && request.method === 'GET') {
      // Basic member access uses a verified session and a server-checked Naver
      // identity. Email ownership remains unverified for email-sensitive use.
      if (requireVerifiedEmail) {
        let session;
        try { session = await auth.api.getSession({headers:request.headers}); } catch { return withHeaders(json({error:'not_authorized'},401)); }
        try { if (!await canUseMember(session)) return withHeaders(json({error:'not_authorized'},403)); } catch { return withHeaders(json({error:'unavailable'},503)); }
      }
      const result = await gate.authorize(request); response = result.ok ? json({ok:true}) : json({error:'not_authorized'},result.status);
    } else response = json({error:'not_found'},404);
    return withHeaders(response);
  };
}

export function provisionConsentSchema(database) {
  database.exec('CREATE TABLE IF NOT EXISTS member_terms (version TEXT PRIMARY KEY, digest TEXT NOT NULL); CREATE TABLE IF NOT EXISTS member_consents (user_id TEXT NOT NULL, version TEXT NOT NULL REFERENCES member_terms(version), accepted_at TEXT NOT NULL, PRIMARY KEY (user_id, version));');
}
