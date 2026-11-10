import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsentGate } from './consent.mjs';

test('consent gate fails closed and uses authenticated identity and current server terms', async () => {
  const records = new Set();
  const store = { hasAccepted: async ({ userId, version }) => records.has(`${userId}:${version}`), recordAcceptance: async ({ userId, version }) => records.add(`${userId}:${version}`) };
  const auth = { api: { getSession: async ({ headers }) => headers.get('x-synthetic-session') === 'valid' ? { user: { id: 'member-a' } } : null } };
  const gate = createConsentGate({ auth, store, terms: { version: 'v1', text: 'synthetic terms' }, allowedOrigins: ['https://app.example.test'] });
  const request = (body, { session = 'valid', origin = 'https://app.example.test', method = 'POST' } = {}) => new Request('https://auth.example.test/consent', { method, headers: { 'content-type': 'application/json', origin, 'x-synthetic-session': session }, body: JSON.stringify(body) });
  assert.equal((await gate.authorize(request({}))).status, 403);
  assert.equal((await gate.accept(request({ accepted: true, version: 'v1' }, { session: '' }))).status, 401);
  assert.equal((await gate.accept(request({ accepted: true, version: 'v1' }, { origin: 'https://evil.example.test' }))).status, 403);
  assert.equal((await gate.accept(request({ accepted: true, version: 'old' }))).status, 400);
  assert.equal((await gate.accept(request({ accepted: true, version: 'v1', userId: 'member-b' }))).status, 400);
  assert.equal((await gate.accept(request({ accepted: true, version: 'v1' }))).status, 200);
  assert.equal((await gate.authorize(request({}))).userId, 'member-a');
  assert.equal(records.has('member-b:v1'), false);
  const changed = createConsentGate({ auth, store, terms: { version: 'v2', text: 'new terms' }, allowedOrigins: ['https://app.example.test'] });
  assert.equal((await changed.authorize(request({}))).status, 403);
  const noTerms = createConsentGate({ auth, store, terms: { version: '', text: '' }, allowedOrigins: ['https://app.example.test'] });
  assert.equal((await noTerms.accept(request({ accepted: true, version: '' }))).status, 503);
  assert.equal((await noTerms.authorize(request({}))).ok, false);
  const failedStore = createConsentGate({ auth, store: { hasAccepted: async () => { throw Error(); }, recordAcceptance: async () => { throw Error(); } }, terms: { version: 'v1', text: 'terms' }, allowedOrigins: ['https://app.example.test'] });
  assert.equal((await failedStore.authorize(request({}))).status, 503);
  assert.equal((await failedStore.accept(request({ accepted: true, version: 'v1' }))).status, 503);
});
