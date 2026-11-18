// Integration test only. Connects solely to a disposable local PostgreSQL
// initialized by tests/sql/run-invite-reservation-candidate.sh. Identity,
// authentication and the Naver provider are intentionally simulated.
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createInviteAutomationCandidate } from '../src/invite-automation-candidate.mjs';
import { createSupabaseInviteStore } from '../src/supabase-invite-store.mjs';

const [socket, port] = process.argv.slice(2);
if (!socket || !/^\d+$/.test(port ?? '')) throw Error('missing disposable database');
const execute = promisify(execFile);
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
async function sql(statement, service = true) {
  const { stdout } = await execute('psql', ['-X', '-qAt', '-h', socket, '-p', port, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `${service ? 'set role service_role; ' : ''}${statement}`]);
  return stdout.trim();
}
const params = {
  kits_ads_invite_consent: ['p_request_id', 'p_user_id', 'p_recipient_id', 'p_role'],
  kits_ads_invite_revoke: ['p_request_id', 'p_user_id'],
  kits_ads_invite_job: ['p_request_id'],
  kits_ads_invite_reserve: ['p_request_id', 'p_user_id', 'p_ad_account_id', 'p_revision', 'p_recipient_id', 'p_role'],
  kits_ads_invite_finish: ['p_request_id', 'p_outcome'],
};
const rpcClient = {
  async rpc(name, args) {
    if (!Object.hasOwn(params, name)) throw Error('unexpected RPC');
    const input = params[name].map(key => literal(args[key])).join(',');
    const expression = name === 'kits_ads_invite_job'
      ? `select coalesce(json_agg(row_to_json(t)), '[]'::json) from public.${name}(${input}) t`
      : `select to_json(public.${name}(${input}))`;
    return { data: JSON.parse(await sql(expression)), error: null };
  },
};
const userId = '33333333-3333-4333-8333-333333333333';
const first = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const second = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
await sql(`insert into auth.users values (${literal(userId)}); insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values (${literal(first)},${literal(userId)},'321'),(${literal(second)},${literal(userId)},'654')`, false);
const repository = createSupabaseInviteStore(rpcClient);
const recipientId = 'fixed-recipient';
const role = 'OPERATIONS_MANAGER';
for (const requestId of [first, second]) assert.equal(await repository.consent({ requestId, userId, recipientId, role }), true);

let invited = 0, accepted = 0;
const run = createInviteAutomationCandidate({
  enabled: true, recipientId, role, repository,
  auth: { verify: async token => token === 'fixture-token' ? { userId, sessionBinding: 'fixture-session' } : null },
  identity: { verify: async () => true },
  provider: {
    invite: async data => {
      invited++;
      if (data.requestId === second) await repository.revoke({ requestId: second, userId });
      return { ...data, verified: true, invitationId: 'fixture-invitation' };
    },
    accept: async data => { accepted++; return { ...data, verified: true }; },
  },
});
const input = requestId => ({ token: 'fixture-token', requestId });
const results = await Promise.all([run(input(first)), run(input(first))]);
assert.deepEqual(results.map(x => x.status).sort(), ['blocked', 'pending_review']);
assert.equal(invited, 1); assert.equal(accepted, 1);
assert.equal(await sql(`select outcome from kitsnode_ads_private.invite_attempts where connection_id=${literal(first)}`, false), 'pending_review');
assert.equal((await run(input(second))).status, 'blocked');
assert.equal(invited, 2); assert.equal(accepted, 1);
assert.equal(await sql(`select outcome from kitsnode_ads_private.invite_attempts where connection_id=${literal(second)}`, false), 'blocked');
assert.equal((await run(input(second))).status, 'blocked');
console.log('service + store + disposable PostgreSQL: single reservation, bound recipient, revocation and persisted outcomes verified; provider and identity simulated');
