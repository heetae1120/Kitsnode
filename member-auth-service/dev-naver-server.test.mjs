import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDevServer } from './dev-naver-server.mjs';

test('development gateway uses real callback path but never stores provider token or links active sessions', async () => {
  const fetchImpl = async (url) => {
    if (url === 'https://nid.naver.com/oauth2.0/token') return Response.json({access_token:'synthetic-sensitive-token', token_type:'Bearer'});
    if (url === 'https://openapi.naver.com/v1/nid/me') return Response.json({resultcode:'00',response:{id:'synthetic-id',email:'synthetic@example.test'}});
    throw new Error('unexpected network');
  };
  const {handler, db} = await createDevServer({clientId:'fixture',clientSecret:'fixture',fetchImpl});
  const root='http://127.0.0.1:4313';
  const post = (path, body, extra={}) => new Request(root+path,{method:'POST',headers:{origin:root,'content-type':'application/json',...extra},body:JSON.stringify(body)});
  try {
    assert.equal((await handler(new Request(root+'/dev/'))).status,200);
    assert.equal((await handler(post('/api/auth/link-social',{}))).status,404);
    assert.equal((await handler(post('/api/auth/sign-in/social',{provider:'naver',callbackURL:'https://example.test/'}))).status,400);
    const start=await handler(post('/api/auth/sign-in/social',{provider:'naver',callbackURL:root+'/dev/'}));
    assert.equal(start.status,200);
    const state=new URL((await start.json()).url).searchParams.get('state');
    const cookie=start.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
    const callback=await handler(new Request(`${root}/api/auth/callback/naver?code=fixture&state=${encodeURIComponent(state)}`,{headers:{cookie}}));
    assert.equal(callback.status,302);
    const sessionCookie=callback.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
    assert.ok(sessionCookie.includes('session_token'));
    assert.equal((await handler(post('/api/auth/sign-in/social',{provider:'naver',callbackURL:root+'/dev/'},{cookie:sessionCookie}))).status,403);
    const frontend='http://127.0.0.1:4312';
    const memberSession=await handler(new Request(root+'/api/member/session',{headers:{origin:frontend,cookie:sessionCookie}}));
    assert.equal(memberSession.headers.get('access-control-allow-origin'),frontend);
    assert.deepEqual(await memberSession.json(),{authenticated:true,consented:false,memberAccess:true,naverAvailable:true,emailAvailable:false,emailVerified:false,emailVerificationAvailable:false});
    const terms=await handler(new Request(root+'/api/member/terms',{headers:{origin:frontend}}));
    assert.equal((await terms.json()).version,'local-fixture-v1');
    const privateBefore=await handler(new Request(root+'/api/member/private',{headers:{origin:frontend,cookie:sessionCookie}}));
    assert.equal(privateBefore.status,403);
    const consent=await handler(new Request(root+'/api/member/consent',{method:'POST',headers:{origin:frontend,cookie:sessionCookie,'content-type':'application/json'},body:JSON.stringify({accepted:true,version:'local-fixture-v1'})}));
    assert.equal(consent.status,200);
    assert.equal((await handler(new Request(root+'/api/member/private',{headers:{origin:frontend,cookie:sessionCookie}}))).status,200);
    assert.equal((await handler(post('/api/auth/sign-up/email',{}))).status,404);
    assert.equal((await handler(new Request(root+'/api/member/session',{headers:{origin:'http://evil.test'}}))).status,403);
    const account=db.prepare('SELECT accessToken, refreshToken, idToken FROM account').get();
    assert.equal(account.accessToken,null); assert.equal(account.refreshToken,null); assert.equal(account.idToken,null);
    assert.equal((await handler(new Request(root+'/api/auth/get-access-token',{headers:{cookie:sessionCookie}}))).status,404);
  } finally { db.close(); }
});
