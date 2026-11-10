import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardIdentityLink } from './link-guard.mjs';

const origin = 'http://127.0.0.1:4313';
const auth = value => ({ api: { getSession: async () => value } });
const req = (path, body, method = 'POST') => new Request(origin + path, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });

test('explicit linking and unlinking fail closed for any session and method', async () => {
  for (const path of ['/api/auth/link-social', '/api/auth/unlink-account']) {
    for (const session of [null, { user: { id: 'fixture-user' } }]) {
      assert.equal((await guardIdentityLink(req(path, {}), auth(session))).status, 403);
      assert.equal((await guardIdentityLink(req(path, undefined, 'GET'), auth(session))).status, 403);
    }
  }
});

test('Naver login only proceeds for a valid anonymous session and simple OAuth request', async () => {
  assert.equal(await guardIdentityLink(req('/api/auth/sign-in/social', { provider: 'naver', callbackURL: origin + '/' }), auth(null)), null);
  for (const session of [{}, { user: { id: 'fixture-user' } }, { session: {} }]) assert.equal((await guardIdentityLink(req('/api/auth/sign-in/social', { provider: 'naver' }), auth(session))).status, 403);
  for (const body of [{ provider: 'naver', idToken: { token: 'fixture' } }, { provider: 'naver', accountId: 'other' }, { provider: 'other' }, []]) assert.equal((await guardIdentityLink(req('/api/auth/sign-in/social', body), auth(null))).status, 400);
  assert.equal((await guardIdentityLink(req('/api/auth/sign-in/social', { provider: 'naver' }), { api: { getSession: async () => { throw Error('unavailable'); } } })).status, 503);
  assert.equal((await guardIdentityLink(req('/api/auth/sign-in/social', { provider: 'naver' }), {})).status, 503);
  assert.equal(await guardIdentityLink(req('/api/auth/sign-in/email', {}), auth(null)), null);
});
