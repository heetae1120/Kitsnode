import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalInvitePreparation } from './invite-local-preparation.mjs';

function fixture({ recipientVerified = true, prepareStatus = 'dialog_open_requested' } = {}) {
  const calls = [];
  const advertiser = {};
  const recipient = { evaluate: async (_, id) => { calls.push(['recipient', id]); return recipientVerified; } };
  const args = {
    accountId: '123', advertiserId: 'owner', recipientId: 'manager',
    onWindowReady: async () => {},
    onPolicyReview: async x => calls.push(['review', x.accountId, x.recipientId]),
    openSessions: async options => { calls.push(['open', typeof options.onWindowReady]); return { advertiser, recipient, close: async () => calls.push(['close']) }; },
    prepareDialog: async x => { calls.push(['prepare', x.accountId, x.viewerId, x.page === advertiser]); return { status: prepareStatus }; },
  };
  return { args, calls };
}
test('opens separate sessions and prepares the exact advertiser account; cleans up', async () => {
  const { args, calls } = fixture();
  assert.deepEqual(await runLocalInvitePreparation(args), { status: 'prepared_only', next: 'manual_review' });
  assert.deepEqual(calls, [['open', 'function'], ['recipient', 'manager'], ['prepare', '123', 'owner', true], ['review', '123', 'manager'], ['close']]);
});
test('recipient mismatch and dialog failure never reach review and still clean up', async () => {
  for (const options of [{ recipientVerified: false }, { prepareStatus: 'unverified' }]) {
    const { args, calls } = fixture(options);
    assert.deepEqual(await runLocalInvitePreparation(args), { status: 'unverified' });
    assert.equal(calls.some(x => x[0] === 'review'), false);
    assert.deepEqual(calls.at(-1), ['close']);
  }
});
test('failed callbacks clean up, same account is rejected before launch', async () => {
  const { args, calls } = fixture();
  args.onPolicyReview = async () => { throw Error('sensitive details'); };
  assert.deepEqual(await runLocalInvitePreparation(args), { status: 'unverified' });
  assert.deepEqual(calls.at(-1), ['close']);
  args.recipientId = 'owner';
  await assert.rejects(() => runLocalInvitePreparation(args), TypeError);
});
