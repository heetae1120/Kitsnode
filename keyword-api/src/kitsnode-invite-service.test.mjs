import test from 'node:test';
import assert from 'node:assert/strict';
import { createKitsnodeInviteService } from './kitsnode-invite-service.mjs';

function fixture() {
  const calls = [];
  const job = {userId:'user-1', state:'pending_review', consent:true, adAccountId:'123', revision:'1'};
  const service = createKitsnodeInviteService({enabled:true,
    // Arbitrary caller-supplied configuration fields are ignored: only trusted
    // code determines the recipient and permission in this factory.
    recipientId:'attacker', role:'OWNER',
    auth:{verify:async () => ({userId:'user-1',sessionBinding:'session-1'})},
    repository:{getJob:async () => job, reserve:async x => (calls.push(['reserve',x]),true), finish:async () => true},
    identity:{verify:async () => true},
    provider:{
      invite:async x => {calls.push(['invite',x]);return {...x,verified:true,invitationId:'fixture-id'};},
      accept:async x => {calls.push(['accept',x]);return {...x,verified:true};},
    },
  });
  return {service,calls};
}

test('the server fixes kitsnode as the operations manager for both steps', async () => {
  const {service,calls} = fixture();
  assert.deepEqual(await service({requestId:'request-1',token:'token'}),{status:'pending_review',retry:'disabled'});
  assert.deepEqual(calls.map(([name]) => name),['reserve','invite','accept']);
  for (const [,x] of calls) {
    assert.equal(x.recipientId,'kitsnode');
    assert.equal(x.role,'OPERATIONS_MANAGER');
    assert.equal(x.adAccountId,'123');
  }
});

test('untrusted input cannot select a different recipient or role', async () => {
  for (const extra of [{recipientId:'jonho1'},{role:'OWNER'},{adAccountId:'456'}]) {
    const {service,calls} = fixture();
    assert.deepEqual(await service({requestId:'request-1',token:'token',...extra}),{status:'blocked'});
    assert.equal(calls.length,0);
  }
});

test('automation is disabled without explicit server configuration', async () => {
  const run = createKitsnodeInviteService();
  assert.deepEqual(await run({requestId:'request-1',token:'token'}),{status:'disabled'});
});
