import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAuthAvailable, isMemberPreview, memberAuthBase, memberRequest, naverAuthorizationUrl } from '../src/lib/member-auth-client';

test('authentication endpoint requires a safe origin', () => {
  assert.equal(memberAuthBase('https://auth.example.test'), 'https://auth.example.test');
  assert.equal(memberAuthBase('http://127.0.0.1:4400'), 'http://127.0.0.1:4400');
  for (const value of ['', 'http://example.test', 'https://u:p@example.test', 'https://example.test/path', 'javascript:alert(1)']) assert.equal(memberAuthBase(value), null);
});

test('email forms fail closed unless the server explicitly enables them', () => {
  assert.equal(isEmailAuthAvailable({ emailAvailable: true }), true);
  for (const session of [null, {}, {emailAvailable:false}, {emailAvailable:'true'}]) assert.equal(isEmailAuthAvailable(session), false);
});

test('preview and editor modes never issue authentication requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected network'); };
  try {
    assert.equal(isMemberPreview('?kits_preview=1'), true);
    for (const search of ['?kits_preview=1', '?kits_editor=1']) await assert.rejects(memberRequest('https://auth.example.test', search, '/api/member/session'));
    await assert.rejects(memberRequest(null, '', '/api/auth/sign-in/email', {}));
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('auth requests include credentials and fail on server errors', async () => {
  const original = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => { request = init; return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    await memberRequest('https://auth.example.test', '', '/api/member/consent', { accepted: true, version: 'v1' });
    assert.equal(request?.credentials, 'include');
    assert.equal(request?.method, 'POST');
    assert.deepEqual(JSON.parse(String(request?.body)), { accepted: true, version: 'v1' });
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(memberRequest('https://auth.example.test', '', '/api/member/consent', {}));
  } finally { globalThis.fetch = original; }
});

test('Naver redirect must be the official authorize URL bound to our auth callback', () => {
  const base = 'https://auth.example.test';
  const good = new URL('https://nid.naver.com/oauth2.0/authorize');
  for (const [key,value] of Object.entries({client_id:'synthetic',state:'synthetic-state',response_type:'code',redirect_uri:`${base}/api/auth/callback/naver`})) good.searchParams.set(key,value);
  assert.equal(naverAuthorizationUrl(good.href,base),good.href);
  const wrongHost = new URL(good); wrongHost.hostname='nid.naver.com.attacker.test';
  const wrongCallback = new URL(good); wrongCallback.searchParams.set('redirect_uri','https://attacker.test/callback');
  const duplicateState = new URL(good); duplicateState.searchParams.append('state','attacker');
  const noState = new URL(good); noState.searchParams.delete('state');
  for (const url of [wrongHost,wrongCallback,duplicateState,noState]) assert.equal(naverAuthorizationUrl(url.href,base),null);
  assert.equal(naverAuthorizationUrl(null,base),null);
});
