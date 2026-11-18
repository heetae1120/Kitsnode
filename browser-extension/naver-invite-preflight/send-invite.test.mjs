import test from 'node:test';
import assert from 'node:assert/strict';
import { sendInvite, inspectInvite } from './send-invite.mjs';

function fixture({ prior = false, allow = true, storageFails = false, locked = false } = {}) {
  const calls = [];
  const chromeApi = { tabs: { query: async () => [{ id: 4, url: 'https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited' }] },
    storage: { local: { get: async () => prior ? { invite_attempt_123_kitsnode: {} } : {}, set: async () => { calls.push('stored'); if (storageFails) throw Error('storage'); } } } };
  const execute = async (_api, action, _url, tab, viewer) => { calls.push(action); assert.equal(tab, 4); if (action === 'viewer') return 'viewer:advertiser'; assert.equal(viewer, 'advertiser'); return action === 'inspect_send' ? 'ready' : 'send_attempted'; };
  const locks = { request: async (_key, _options, fn) => fn(locked ? null : {}) };
  return { calls, input: { chromeApi, execute, locks, confirmAction: async () => allow } };
}
test('binds the active tab and viewer and records before invoking the send', async () => {
  const f=fixture(); assert.equal(await sendInvite(f.input),'uncertain'); assert.deepEqual(f.calls,['viewer','inspect_send','stored','send']);
});
test('prior attempts, concurrent work and cancelled confirmation never send', async () => {
  for (const options of [{prior:true},{locked:true},{allow:false}]) { const f=fixture(options); await sendInvite(f.input); assert.equal(f.calls.includes('send'),false); }
});
test('missing lock or failed storage never sends', async () => {
  const a=fixture(); a.input.locks=null; assert.equal(await sendInvite(a.input),'unavailable'); assert.deepEqual(a.calls,[]);
  const b=fixture({storageFails:true}); await assert.rejects(sendInvite(b.input)); assert.equal(b.calls.includes('send'),false);
});
test('uncertain execution remains uncertain and never changes the bound viewer', async () => {
  const f=fixture(); const original=f.input.execute; f.input.execute=async (...args) => { if(args[1]==='send') throw Error('network'); return original(...args); };
  assert.equal(await sendInvite(f.input),'uncertain');
});
test('reports whether viewer or final role verification stopped before storing',async()=>{
 for(const [action,result,expected] of [['viewer','unverified','viewer_unverified'],['inspect_send','unverified','role_unverified']]){
  const f=fixture();const original=f.input.execute;f.input.execute=async(...args)=>args[1]===action?result:original(...args);
  assert.equal(await sendInvite(f.input),expected);assert.equal(f.calls.includes('stored'),false);assert.equal(f.calls.includes('send'),false);
 }
});
test('diagnosis checks current state without sending or writing',async()=>{
 for(const options of [{},{prior:true}]){
  const f=fixture(options);const result=await inspectInvite(f.input);
  assert.equal(result,options.prior?'previous_attempt':'ready');assert.deepEqual(f.calls,['viewer','inspect_send']);
 }
});
