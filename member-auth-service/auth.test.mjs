import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createMemberAuth } from './auth.mjs';
import { createSmtpMailSender } from './mail.mjs';
import { createConsentGate } from './consent.mjs';

test('verification is required and recovery sends synthetic email', async () => {
  const db = new DatabaseSync(':memory:');
  const mail = [];
  const auth = createMemberAuth({ database: db, baseURL: 'http://localhost:3000', secret: 'synthetic-secret-do-not-use-in-production-1234567890', trustedOrigins: ['http://localhost:3000'], sendMail: async item => mail.push(item) });
  try {
    const context = await auth.$context;
    await (await getMigrations(context.options)).runMigrations();
    assert.equal(context.options.account.accountLinking.disableImplicitLinking, true);
    const post = (path, body) => auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify(body) }));
    const user = { email: 'fixture@example.test', password: 'synthetic-password-123', name: 'fixture' };
    assert.equal((await post('sign-up/email', user)).status, 200);
    assert.equal(mail[0].kind, 'verification');
    assert.equal((await post('sign-in/email', user)).status, 403);
    const verification = await auth.handler(new Request(mail[0].url));
    assert.ok(verification.status >= 200 && verification.status < 400);
    const signin = await post('sign-in/email', user);
    assert.equal(signin.status, 200);
    const cookie = signin.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const records = new Set();
    const gate = createConsentGate({ auth, store: { hasAccepted: async ({ userId, version }) => records.has(`${userId}:${version}`), recordAcceptance: async ({ userId, version }) => records.add(`${userId}:${version}`) }, terms: { version: 'fixture-v1', text: 'fixture terms' }, allowedOrigins: ['http://localhost:3000'] });
    const consentRequest = new Request('http://localhost:3000/consent', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie }, body: JSON.stringify({ accepted: true, version: 'fixture-v1' }) });
    assert.equal((await gate.authorize(consentRequest)).status, 403);
    assert.equal((await gate.accept(consentRequest)).status, 200);
    assert.equal((await gate.authorize(consentRequest)).ok, true);
    const forged = new Request('http://localhost:3000/protected', { headers: { cookie: 'better-auth.session_token=forged' } });
    assert.equal((await gate.authorize(forged)).ok, false);
    assert.equal((await post('request-password-reset', { email: user.email, redirectTo: 'http://localhost:3000/reset' })).status, 200);
    assert.equal(mail.at(-1).kind, 'reset');
  } finally { db.close(); }
});

test('startup remains disabled', async () => {
  await assert.rejects(import('./server.mjs'), /disabled/);
});

test('SMTP sender validates callback origin and does not send invalid mail', async () => {
  const sent = [];
  const sender = createSmtpMailSender({ host: 'smtp.example.test', port: 465, user: 'fixture', password: 'fixture', from: 'fixture@example.test', authBaseURL: 'https://auth.example.test', transport: { sendMail: async msg => sent.push(msg) } });
  await sender({ to: 'fixture@example.test', kind: 'reset', url: 'https://auth.example.test/api/auth/reset-password/token' });
  assert.equal(sent.length, 1);
  await assert.rejects(sender({ to: 'fixture@example.test', kind: 'reset', url: 'https://attacker.example.test/' }));
  assert.equal(sent.length, 1);
});
