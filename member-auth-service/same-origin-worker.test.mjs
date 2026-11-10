import test from 'node:test';
import assert from 'node:assert/strict';
import {createSameOriginWorker} from './same-origin-worker.mjs';

test('same-origin static pages and auth requests reach separate handlers', async () => {
  const calls = [];
  const worker = createSameOriginWorker({auth:{fetch:async request => {calls.push('auth'); return new Response('auth', {headers:{'set-cookie':'session=fixture; HttpOnly; Secure; SameSite=Lax'}})}}});
  const env = {ASSETS:{fetch:async request => {calls.push('assets'); return new Response('page')}}};
  assert.equal(await (await worker.fetch(new Request('https://fixture.example/store/login/'),env)).text(), 'page');
  const response = await worker.fetch(new Request('https://fixture.example/api/member/session'),env);
  assert.equal(await response.text(), 'auth');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.deepEqual(calls, ['assets','auth']);
});

test('API errors never fall back to assets and missing assets fail closed', async () => {
  let assets = 0;
  const worker = createSameOriginWorker({auth:{fetch:async () => new Response(null,{status:503})}});
  const env = {ASSETS:{fetch:async () => {assets++; return new Response('page')}}};
  assert.equal((await worker.fetch(new Request('https://fixture.example/api'),env)).status,503);
  assert.equal((await worker.fetch(new Request('https://fixture.example/api/auth/callback/naver'),env)).status,503);
  assert.equal(assets,0);
  assert.equal((await worker.fetch(new Request('https://fixture.example/store/login/'),{})).status,503);
});
