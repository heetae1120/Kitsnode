import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createFixtureNaverAuth, createMemberAuth } from './auth.mjs';
import { createNaverOAuth } from './naver-oauth.mjs';

test('Naver state is request scoped, verified before exchange, single-use and never linked by email', async () => {
  const db = new DatabaseSync(':memory:');
  const exchanges = [];
  const fetchImpl = async (input, init) => {
    assert.equal(init.redirect, 'manual');
    if (input === 'https://nid.naver.com/oauth2.0/token') {
      const body = new URLSearchParams(init.body);
      exchanges.push({ code: body.get('code'), state: body.get('state') });
      return Response.json({ access_token: `token-${body.get('code')}`, token_type: 'Bearer' });
    }
    assert.equal(input, 'https://openapi.naver.com/v1/nid/me');
    const token = new Headers(init.headers).get('authorization');
    if (token === 'Bearer token-no-email') return Response.json({ resultcode: '00', response: { id: 'missing-email' } });
    return Response.json({ resultcode: '00', response: { id: token, email: token === 'Bearer token-new' ? 'new@example.test' : 'same@example.test', nickname: 'Fixture' } });
  };
  const options = { database: db, baseURL: 'http://localhost:3000', secret: 'fixture-only-secret-not-for-production-1234567890',
    emailAndPassword: { enabled: true }, account: { accountLinking: { enabled: true, disableImplicitLinking: true, trustedProviders: [] } }, logger: { disabled: true } };
  try {
    await (await getMigrations(options)).runMigrations();
    const {auth, handle} = createFixtureNaverAuth({database:db,baseURL:options.baseURL,secret:options.secret,trustedOrigins:[options.baseURL],sendMail:async()=>{},fetchImpl});
    const context = await auth.$context;
    const existing = await context.internalAdapter.createUser({email:'same@example.test', name:'Fixture', emailVerified:true});
    async function start() {
      const res = await auth.handler(new Request('http://localhost:3000/api/auth/sign-in/social', { method:'POST', headers:{'content-type':'application/json', origin:'http://localhost:3000'}, body:JSON.stringify({provider:'naver', callbackURL:'http://localhost:3000/'}) }));
      assert.equal(res.status, 200);
      return { state: new URL((await res.json()).url).searchParams.get('state'), cookie: res.headers.getSetCookie().map(v => v.split(';')[0]).join('; ') };
    }
    async function callback(flow, code, state = flow.state, extra = '') {
      return handle(new Request(`http://localhost:3000/api/auth/callback/naver?code=${code}&state=${encodeURIComponent(state)}${extra}`, { headers:{cookie:flow.cookie} }));
    }
    const one = await start(), two = await start();
    assert.notEqual(one.state, two.state);
    await callback(one, 'bad', 'forged');
    await callback(one, 'bad', two.state);
    assert.equal((await callback(one, 'bad', one.state, '&state=extra')).status, 400);
    assert.equal(exchanges.length, 0);
    await Promise.all([callback(one, 'first'), callback(two, 'second')]);
    assert.deepEqual(exchanges.sort((a,b) => a.code.localeCompare(b.code)), [{code:'first',state:one.state},{code:'second',state:two.state}]);
    await callback(one, 'replay');
    assert.equal(exchanges.length, 2);
    assert.equal((await context.internalAdapter.findAccounts(existing.id)).length, 0);
    // Bypassing the wrapper cannot supply the token hook with state.
    const three = await start();
    await auth.handler(new Request(`http://localhost:3000/api/auth/callback/naver?code=bypass&state=${encodeURIComponent(three.state)}`, {headers:{cookie:three.cookie}}));
    assert.equal(exchanges.length, 2);
    const missingEmail = await start();
    const missingResponse = await callback(missingEmail, 'no-email');
    assert.match(missingResponse.headers.get('location'), /error=/);
    assert.equal(await context.internalAdapter.findUserByEmail('new@example.test'), null);
    const fresh = await start();
    const success = await callback(fresh, 'new');
    assert.equal(success.status, 302);
    assert.equal(new URL(success.headers.get('location')).pathname, '/');
    const created = await context.internalAdapter.findUserByEmail('new@example.test');
    assert.ok(created?.user?.id);
    assert.equal((await context.internalAdapter.findAccounts(created.user.id))[0].accountId, 'Bearer token-new');
    assert.ok(success.headers.getSetCookie().some(v => /session_token/.test(v)));
    const rejected = await start();
    const before = exchanges.length;
    await handle(new Request(`http://localhost:3000/api/auth/callback/naver?error=access_denied&state=${encodeURIComponent(rejected.state)}`, {headers:{cookie:rejected.cookie}}));
    assert.equal(exchanges.length, before);
    // Two simultaneous callbacks for the same state must never trigger two
    // exchanges, even if the library's state reads race before deletion.
    const concurrent = await start();
    const previous = exchanges.length;
    await Promise.all([callback(concurrent, 'same-state-1'), callback(concurrent, 'same-state-2')]);
    assert.equal(exchanges.length - previous, 1);
  } finally { db.close(); }
});

test('provider redirects are not followed or parsed for tokens and profiles', async () => {
  const responses = [300, 301, 302, 303, 307, 308].map(status => new Response(null, {status,headers:{location:'https://untrusted.example.test/'}}));
  responses.push({ok:true,status:0,type:'opaqueredirect',json:async()=>{throw new Error('unexpected parse')}});
  responses.push({ok:true,status:200,type:'basic',redirected:true,json:async()=>{throw new Error('unexpected parse')}});
  for (const providerResponse of responses) {
    const calls=[];
    const {plugin,handle}=createNaverOAuth({clientId:'fixture',clientSecret:'fixture',claimState:async()=>true,fetchImpl:async(input,init)=>{calls.push({input,redirect:init.redirect});return providerResponse}});
    const config=plugin.options.config[0];
    await assert.rejects(handle(new Request('https://auth.example.test/api/auth/callback/naver?code=fixture&state=fixture'),()=>config.getToken({code:'fixture',redirectURI:'https://auth.example.test/api/auth/callback/naver'})),/Naver token exchange failed/);
    assert.equal(await config.getUserInfo({accessToken:'synthetic-token'}),null);
    assert.deepEqual(calls,[{input:'https://nid.naver.com/oauth2.0/token',redirect:'manual'},{input:'https://openapi.naver.com/v1/nid/me',redirect:'manual'}]);
  }
});

test('real provider configuration remains blocked and fixture rejects non-loopback', () => {
  assert.throws(() => createNaverOAuth({clientId:'fixture',clientSecret:'fixture'}), /atomic state store/);
  assert.throws(() => createMemberAuth({database:{},baseURL:'https://example.test',secret:'fixture',trustedOrigins:[],sendMail:async()=>{},naver:{clientId:'x'}}), /disabled/);
  assert.throws(() => createFixtureNaverAuth({database:{},baseURL:'https://example.test',secret:'fixture',trustedOrigins:['https://example.test'],sendMail:async()=>{},fetchImpl:async()=>{}}), /loopback/);
});
