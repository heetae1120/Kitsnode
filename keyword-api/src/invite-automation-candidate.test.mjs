import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInviteAutomationCandidate } from './invite-automation-candidate.mjs';

function fixture() {
  const job = { userId: 'user1', adAccountId: 'ad1', state: 'pending_review', consent: true, revision: '1' };
  const calls = [];
  let held = false;
  const deps = {
    enabled: true, recipientId: 'jonho1', role: 'OPERATIONS_MANAGER',
    auth: { verify: async () => ({ userId: 'user1', sessionBinding: 'session1' }) },
    identity: { verify: async () => true },
    repository: {
      getJob: async () => ({ ...job }),
      reserve: async (expected) => {
        if (held || !job.consent || expected.revision !== job.revision || expected.adAccountId !== job.adAccountId) return false;
        held = true; return true;
      },
      finish: async (_, status) => { calls.push(['finish', status]); },
    },
    provider: {
      invite: async (x) => { calls.push(['invite', x]); return { ...x, verified: true, invitationId: 'i1' }; },
      accept: async (x) => { calls.push(['accept', x]); return { ...x, verified: true }; },
    },
  };
  return { deps, job, calls, run: () => createInviteAutomationCandidate(deps)({ token: 'token', requestId: 'job1' }) };
}

test('disabled and untrusted request parameters cannot trigger providers', async () => {
  const f = fixture(); f.deps.enabled = false;
  assert.equal((await f.run()).status, 'disabled');
  f.deps.enabled = true;
  const run = createInviteAutomationCandidate(f.deps);
  assert.equal((await run({ token: 'token', requestId: 'job1', recipientId: 'attacker' })).status, 'blocked');
  assert.equal(f.calls.length, 0);
});

test('verified identity, job ownership, and consent are mandatory', async () => {
  for (const change of [f => { f.job.userId = 'other'; }, f => { f.job.consent = false; }, f => { f.deps.identity.verify = async () => false; }]) {
    const f = fixture(); change(f);
    assert.equal((await f.run()).status, 'blocked'); assert.equal(f.calls.length, 0);
  }
});

test('concurrent replay is reserved once; fixed recipient and account are used', async () => {
  const f = fixture(); const results = await Promise.all([f.run(), f.run()]);
  assert.deepEqual(results.map(x => x.status).sort(), ['blocked', 'pending_review']);
  assert.equal(f.calls.filter(x => x[0] === 'invite').length, 1);
  assert.equal(f.calls.filter(x => x[0] === 'accept').length, 1);
  const args = f.calls[0][1]; assert.equal(args.recipientId, 'jonho1'); assert.equal(args.adAccountId, 'ad1'); assert.equal(args.role, 'OPERATIONS_MANAGER');
});

test('revoked consent before invitation or acceptance stops the next action', async () => {
  let f = fixture();
  const reserve = f.deps.repository.reserve;
  f.deps.repository.reserve = async x => { const r = await reserve(x); f.job.consent = false; return r; };
  assert.equal((await f.run()).status, 'blocked'); assert.equal(f.calls.filter(x => x[0] === 'invite').length, 0);
  f = fixture(); const invite = f.deps.provider.invite;
  f.deps.provider.invite = async x => { const result = await invite(x); f.job.consent = false; return result; };
  assert.deepEqual(await f.run(), { status: 'uncertain', retry: 'disabled' });
  assert.equal(f.calls.filter(x => x[0] === 'accept').length, 0);
  assert.deepEqual(f.calls.at(-1), ['finish', 'uncertain']);
  assert.equal((await f.run()).status, 'blocked');
});

test('ambiguous evidence and provider failures never lead to automatic retry', async () => {
  for (const invite of [async () => ({ verified: true, adAccountId: 'wrong' }), async () => { throw new Error('secret'); }]) {
    const f = fixture(); f.deps.provider.invite = invite;
    assert.deepEqual(await f.run(), { status: 'uncertain', retry: 'disabled' });
    assert.equal((await f.run()).status, 'blocked'); assert.equal(f.calls.filter(x => x[0] === 'accept').length, 0);
  }
});

test('audit failure does not permit repeat provider calls', async () => {
  for (const finish of [async () => { throw Error('failed'); }, async () => false]) {
    const f = fixture(); f.deps.repository.finish = finish;
    assert.deepEqual(await f.run(), { status: 'audit_unconfirmed', retry: 'disabled' });
    assert.equal((await f.run()).status, 'blocked');
    assert.equal(f.calls.filter(x => x[0] === 'invite').length, 1);
  }
});
