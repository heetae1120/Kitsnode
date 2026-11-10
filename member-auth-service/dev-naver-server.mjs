// Loopback-only, ephemeral development harness. Never exposes a production app.
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { createDevNaverAuth } from './auth.mjs';
import { createMemberApp, provisionConsentSchema } from './app.mjs';

const origin = 'http://127.0.0.1:4313';
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>네이버 로그인 개발 시험</title><main><h1>네이버 로그인 개발 시험</h1><p>테스트 전용입니다. 서버를 종료하면 모든 계정과 세션이 삭제됩니다.</p><button id="login" type="button">네이버 로그인 시험</button><button id="logout" type="button">테스트 세션 종료</button><p id="status" role="status"></p></main><script>
const status=document.getElementById('status');
async function session(){const r=await fetch('/api/member/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();status.textContent=s&&s.authenticated?'테스트 로그인 완료':'로그인 전';}
document.getElementById('login').onclick=async()=>{try{const r=await fetch('/api/auth/sign-in/social',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'naver',callbackURL:location.origin+'/dev/'})});const d=await r.json();const u=new URL(d.url);if(!r.ok||u.origin!=='https://nid.naver.com'||u.pathname!=='/oauth2.0/authorize')throw Error();location.assign(u.href)}catch{status.textContent='로그인을 시작하지 못했습니다. 기존 테스트 세션을 종료했는지 확인해 주세요.'}};
document.getElementById('logout').onclick=async()=>{try{const r=await fetch('/api/auth/sign-out',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});if(!r.ok)throw Error();await session()}catch{status.textContent='세션 종료에 실패했습니다.'}};
session().catch(()=>{status.textContent='세션을 확인할 수 없습니다.'});</script></html>`;

export async function createDevServer({ clientId, clientSecret, fetchImpl = fetch }) {
  if (!clientId || !clientSecret) throw new Error('Naver development credentials are required');
  const db = new DatabaseSync(':memory:');
  const { auth, handle } = createDevNaverAuth({ database: db, baseURL: origin,
    secret: randomBytes(32).toString('hex'), trustedOrigins: [origin,'http://127.0.0.1:4312'],
    // The harness exposes no email endpoints and intentionally sends no mail.
    sendMail: async () => {},
    naver: { clientId, clientSecret }, fetchImpl });
  await (await getMigrations((await auth.$context).options)).runMigrations();
  provisionConsentSchema(db);
  const app = createMemberApp({auth:{...auth,handler:handle},database:db,terms:{version:'local-fixture-v1',text:'테스트 전용 가상 약관입니다. 실제 서비스 이용약관이나 개인정보 처리 동의가 아닙니다.'},allowedOrigins:[origin,'http://127.0.0.1:4312'],naverCallbackURLs:[`${origin}/dev/`,'http://127.0.0.1:4312/store/login/'],emailAvailable:false});
  const handler = async request => {
    const url = new URL(request.url);
    if (url.origin !== origin) return new Response('Forbidden', { status: 403 });
    const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'" };
    if (url.pathname === '/dev/' && request.method === 'GET') return new Response(page, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    const routes = new Set(['/api/auth/sign-in/social','/api/auth/sign-out','/api/auth/callback/naver','/api/member/session','/api/member/terms','/api/member/consent','/api/member/private']);
    if (!routes.has(url.pathname)) return new Response('Not found', { status: 404, headers });
    const result = await app(request);
    for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    return result;
  };
  return { server: createServer(toNodeHandler(handler)), db, handler };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.MEMBER_AUTH_DEV_NAVER !== '1' || process.env.NODE_ENV === 'production') throw new Error('Naver development mode is disabled');
  const { server, db } = await createDevServer({ clientId: process.env.NAVER_CLIENT_ID, clientSecret: process.env.NAVER_CLIENT_SECRET });
  server.listen(4313, '127.0.0.1', () => process.stdout.write('Local Naver test: http://127.0.0.1:4313/dev/\n'));
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
