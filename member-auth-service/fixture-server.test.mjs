import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createFixtureServer } from './fixture-server.mjs';

test('fixture fails closed unless explicitly opted in and never starts in production', () => {
  for (const env of [{ MEMBER_AUTH_FIXTURE: '' }, { MEMBER_AUTH_FIXTURE: '1', NODE_ENV: 'production' }]) {
    const child = spawnSync(process.execPath, ['fixture-server.mjs'], { cwd: import.meta.dirname, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 15000 });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /outside production/);
  }
});

test('fixture permits only synthetic accounts, exact origin, and ephemeral email', async () => {
  const { handler, db } = await createFixtureServer();
  const origin = 'http://127.0.0.1:4312';
  const get = (path, from = origin) => handler(new Request('http://127.0.0.1:4313' + path, { headers: { origin: from } }));
  const post = (path, body) => handler(new Request('http://127.0.0.1:4313' + path, { method:'POST', headers:{origin,'content-type':'application/json'}, body:JSON.stringify(body) }));
  try {
    assert.equal((await get('/__fixture/mail', 'https://evil.example')).status, 403);
    assert.equal((await handler(new Request('http://127.0.0.1:4313/__fixture/mail'))).status, 403);
    assert.equal((await handler(new Request('http://attacker.example/__fixture/mail', {headers:{origin}}))).status, 403);
    assert.equal((await get('/api/auth/sign-in/social')).status, 404);
    assert.equal((await post('/api/auth/sign-up/email', {email:'user@real.example', password:'synthetic-password-123'})).status, 400);
    const terms = await (await get('/api/member/terms')).json();
    assert.deepEqual(terms.documents.map(d => d.type), ['terms','privacy']);
    assert.ok(terms.documents.every(d => /테스트 전용/.test(d.text)));
    assert.match(terms.documents[0].text, /1 서비스 이용약관/);
    assert.match(terms.documents[1].text, /2 회원가입 개인정보 수집·이용 동의서/);
    assert.ok(terms.documents.every(d => !/3 네이버 검색광고 계정 접근/.test(d.text)));
    const consents = terms.documents.map(({type,version}) => ({type,version,accepted:true}));
    assert.equal((await post('/api/auth/sign-up/email', {name:'fixture',email:'fixture@example.test',password:'synthetic-password-123',consents:consents.slice(0,1)})).status, 400);
    const response = await post('/api/auth/sign-up/email', {name:'fixture',email:'fixture@example.test',password:'synthetic-password-123',consents});
    assert.equal(response.status, 200);
    const mail = await (await get('/__fixture/mail')).json();
    assert.equal(mail.length, 1);
    assert.equal(mail[0].kind, 'verification');
    assert.equal(new URL(mail[0].url).origin, 'http://127.0.0.1:4313');
    assert.ok((await handler(new Request(mail[0].url))).status < 400);
    assert.equal((await post('/api/auth/request-password-reset', {email:'fixture@example.test',redirectTo:origin + '/store/login/'})).status, 200);
    const reset = (await (await get('/__fixture/mail')).json()).at(-1);
    assert.equal(reset.kind, 'reset');
    const resetResponse = await handler(new Request(reset.url));
    assert.ok(resetResponse.status >= 300 && resetResponse.status < 400);
    assert.equal(new URL(resetResponse.headers.get('location')).origin, origin);
  } finally { db.close(); }
});

test('mock Naver completes through the app and never redirects outside loopback', async () => {
  const { handler, db } = await createFixtureServer({naverFixture:true});
  const origin = 'http://127.0.0.1:4312';
  try {
    const start = await handler(new Request('http://127.0.0.1:4313/api/auth/sign-in/social', {method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({provider:'naver',callbackURL:origin + '/store/login/'})}));
    assert.equal(start.status, 200);
    const authorizeUrl = (await start.json()).url;
    assert.equal(new URL(authorizeUrl).origin, 'http://127.0.0.1:4313');
    assert.equal(new URL(authorizeUrl).pathname, '/__fixture/naver/authorize');
    const cookie = start.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
    const authorize = await handler(new Request(authorizeUrl, {headers:{cookie}}));
    assert.equal(authorize.status,302);
    const callbackUrl = authorize.headers.get('location');
    assert.equal(new URL(callbackUrl).origin, 'http://127.0.0.1:4313');
    const callback = await handler(new Request(callbackUrl, {headers:{cookie}}));
    assert.equal(callback.status,302);
    assert.equal(new URL(callback.headers.get('location')).origin, origin);
    const sessionCookie = callback.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
    assert.match(sessionCookie,/session_token/);
    const session = await handler(new Request('http://127.0.0.1:4313/api/member/session', {headers:{origin,cookie:sessionCookie}}));
    assert.deepEqual(await session.json(),{authenticated:true,consented:false,memberAccess:true,naverAvailable:true,emailAvailable:true,emailVerified:false,emailVerificationAvailable:true,consentStatus:{terms:false,privacy:false}});
    const privateResponse = await handler(new Request('http://127.0.0.1:4313/api/member/private', {headers:{origin,cookie:sessionCookie}}));
    assert.equal(privateResponse.status,403);
    const documents = (await (await handler(new Request('http://127.0.0.1:4313/api/member/terms', {headers:{origin}}))).json()).documents;
    const consent = documents.map(({type,version}) => ({type,version,accepted:true}));
    const postConsent = list => handler(new Request('http://127.0.0.1:4313/api/member/consent', {method:'POST',headers:{origin,cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify({consents:list})}));
    assert.equal((await postConsent([{...consent[0],version:'old'}])).status,400);
    assert.equal((await postConsent([consent[0]])).status,200);
    const partial = await handler(new Request('http://127.0.0.1:4313/api/member/session', {headers:{origin,cookie:sessionCookie}}));
    assert.deepEqual((await partial.json()).consentStatus,{terms:true,privacy:false});
    assert.equal((await handler(new Request('http://127.0.0.1:4313/api/member/private', {headers:{origin,cookie:sessionCookie}}))).status,403);
    assert.equal((await postConsent([consent[1]])).status,200);
    assert.equal((await handler(new Request('http://127.0.0.1:4313/api/member/private', {headers:{origin,cookie:sessionCookie}}))).status,403);
    const verifyRequest=await handler(new Request('http://127.0.0.1:4313/api/member/verify-email', {method:'POST',headers:{origin,cookie:sessionCookie,'content-type':'application/json'},body:'{}'}));
    assert.equal(verifyRequest.status,200);
    const mailbox=await (await handler(new Request('http://127.0.0.1:4313/__fixture/mail',{headers:{origin}}))).json();
    const verifyMail=mailbox.filter(m=>m.kind==='verification').at(-1);
    assert.ok(verifyMail);
    assert.ok((await handler(new Request(verifyMail.url,{headers:{cookie:sessionCookie}}))).status < 400);
    assert.equal((await handler(new Request('http://127.0.0.1:4313/api/member/private', {headers:{origin,cookie:sessionCookie}}))).status,200);
  } finally { db.close(); }
});
