import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorAllowlist,createOwnershipEvidenceVerifier} from './operator-evidence.mjs';
const user='11111111-1111-4111-8111-111111111111', operator='22222222-2222-4222-8222-222222222222', requestId='33333333-3333-4333-8333-333333333333';
const input={requestId,userId:user,adAccountId:'2647636',evidenceRef:'proof-1',operatorId:operator};
const record={ref:'proof-1',requestId,userId:user,adAccountId:'2647636',reviewerId:operator,status:'verified',revokedAt:null,revision:1,proofRef:'external-1',method:'verified-channel',reviewedAt:100,expiresAt:300};
const setup=(row=record,verifyIndependentProof=async()=>true)=>createOwnershipEvidenceVerifier({evidenceStore:{getByRef:async()=>row},verifyIndependentProof,now:()=>200});
test('operator allowlist fails closed and requires valid server-verified subject',async()=>{
 assert.equal(await createOperatorAllowlist('')(operator),false);
 const verify=createOperatorAllowlist(operator.toUpperCase());
 assert.equal(await verify(operator),true);assert.equal(await verify(user),false);assert.equal(await verify({id:operator}),false);
 assert.throws(()=>createOperatorAllowlist(operator+',bad'));assert.throws(()=>createOperatorAllowlist(operator+','+operator));
});
test('proof must be independent, matching, unexpired and unrevoked',async()=>{
 assert.equal(await setup()(input),true);
 for(const patch of [{userId:operator},{requestId:user},{adAccountId:'1'},{status:'pending'},{revokedAt:1},{expiresAt:200},{reviewedAt:201},{revision:-1},{proofRef:''}]) assert.equal(await setup({...record,...patch})(input),false);
 assert.equal(await setup(record,async()=>false)(input),false);
 assert.equal(await setup(record,async()=>{throw Error('offline')})(input),false);
 assert.equal(await setup()( {...input,operatorId:'untrusted'}),false);
});
test('proof verifier receives server-owned bound record, not user supplied proof data',async()=>{
 let args;const verify=setup(record,async value=>{args=value;return true;});
 assert.equal(await verify({...input,proofRef:'forged',reviewerId:user}),true);
 assert.equal(args.proofRef,'external-1');assert.equal(args.reviewerId,operator);
});
