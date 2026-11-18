import test from 'node:test';
import assert from 'node:assert/strict';
import {runLocalInviteWorkflow} from './invite-local-workflow.mjs';

function fixture({pending = true, accepted = true, finish = true, reserve = true} = {}) {
 const calls=[]; const expected={requestId:'req1',accountId:'123',advertiserId:'advertiser',recipientId:'recipient',role:'OPERATIONS_MANAGER'};
 const proof=(status,valid)=>({...expected,verified:valid,status,invitationId:'inv1'});
 const options={...expected,onWindowReady:async()=>{},onPolicyReview:async()=>true,authorize:async()=>true,
  openSessions:async()=>({advertiser:{},recipient:{},close:async()=>calls.push('close')}),
  verifyRecipient:async()=>true,prepareDialog:async()=>({status:'dialog_open_requested'}),
  createInvite:()=>({prepareRecipient:async()=>({status:'ready'}),send:async()=>{calls.push('send');return {status:'uncertain'}}}),
  createAccept:()=>({accept:async()=>{calls.push('accept');return {status:'uncertain'}}}),
  reservation:{reserve:async()=>{calls.push('reserve');return reserve},finish:async x=>{calls.push(x.outcome);return finish}},
  evidence:{pending:async()=>proof('pending',pending),accepted:async()=>proof('accepted',accepted)}};
 return {options,calls};
}
test('proceeds only after exact pending proof and preserves ownership review',async()=>{
 const f=fixture();assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'pending_review',retry:'disabled'});
 assert.deepEqual(f.calls,['reserve','send','accept','pending_review','close']);
});
test('unknown invitation outcome never leads to acceptance or retry',async()=>{
 const f=fixture({pending:false});assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'uncertain',retry:'disabled'});
 assert.deepEqual(f.calls,['reserve','send','uncertain','close']);
});
test('reservation conflict prevents external calls',async()=>{
 const f=fixture({reserve:false});assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'blocked',retry:'disabled'});
 assert.deepEqual(f.calls,['reserve','close']);
});
test('audit failure overrides an otherwise successful outcome',async()=>{
 const f=fixture({finish:false});assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'audit_unconfirmed',retry:'disabled'});
 assert.equal(f.calls.at(-1),'close');
});
test('mismatched accepted invitation cannot be reported successful',async()=>{
 const f=fixture();f.options.evidence.accepted=async()=>({verified:true,status:'accepted',requestId:'req1',accountId:'123',recipientId:'recipient',role:'OPERATIONS_MANAGER',invitationId:'other'});
 assert.equal((await runLocalInviteWorkflow(f.options)).status,'uncertain');
});
test('ambiguous send response remains uncertain after external call',async()=>{
 const f=fixture();f.options.createInvite=()=>({prepareRecipient:async()=>({status:'ready'}),send:async()=>{f.calls.push('send');return {status:'blocked'}}});
 assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'uncertain',retry:'disabled'});
 assert.deepEqual(f.calls,['reserve','send','uncertain','close']);
});
test('evidence for another advertiser cannot authorize accepting',async()=>{
 const f=fixture();f.options.evidence.pending=async()=>({verified:true,status:'pending',requestId:'req1',accountId:'123',advertiserId:'other',recipientId:'recipient',role:'OPERATIONS_MANAGER',invitationId:'inv1'});
 assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'uncertain',retry:'disabled'});
 assert.deepEqual(f.calls,['reserve','send','uncertain','close']);
});
test('does not reserve or invite when the recipient session is unverified',async()=>{
 const f=fixture();f.options.verifyRecipient=async()=>false;
 assert.deepEqual(await runLocalInviteWorkflow(f.options),{status:'blocked',retry:'disabled'});
 assert.deepEqual(f.calls,['close']);
});
