import test from 'node:test';
import assert from 'node:assert/strict';
import {createInviteWorkflowReservation} from './invite-workflow-reservation.mjs';

const userId='11111111-1111-4111-8111-111111111111', requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const expected={requestId,accountId:'123',advertiserId:'advertiser',recipientId:'recipient',role:'OPERATIONS_MANAGER'};
function fixture() {
 const calls=[]; let acquired=false;
 const job={userId,adAccountId:'123',state:'pending_review',consent:true,revision:'3:2'};
 const store={async getJob(){return {...job}},async reserve(x){calls.push(['reserve',x]); if(acquired)return false; acquired=true; return true},async finish(...x){calls.push(['finish',...x])}};
 const adapter=createInviteWorkflowReservation({store,userId,...expected});
 return {adapter,job,store,calls};
}
test('binds trusted request and completes only the held reservation',async()=>{
 const f=fixture();
 assert.equal(await f.adapter.finish({...expected,outcome:'pending_review'}),false);
 assert.equal(await f.adapter.reserve(expected),true);
 assert.equal(await f.adapter.isCurrent(expected),true);
 assert.deepEqual(f.calls[0][1],{requestId,userId,adAccountId:'123',revision:'3:2',recipientId:'recipient',role:'OPERATIONS_MANAGER'});
 assert.equal(await f.adapter.finish({...expected,recipientId:'other',outcome:'uncertain'}),false);
 assert.equal(await f.adapter.finish({...expected,outcome:'uncertain'}),true);
 assert.equal(await f.adapter.finish({...expected,outcome:'uncertain'}),false);
});
test('fresh check detects consent revocation or a changed request revision',async()=>{
 const f=fixture();assert.equal(await f.adapter.isCurrent(expected),false);
 assert.equal(await f.adapter.reserve(expected),true);
 f.job.consent=false;assert.equal(await f.adapter.isCurrent(expected),false);
 f.job.consent=true;f.job.revision='3:3';assert.equal(await f.adapter.isCurrent(expected),false);
});
test('rejects mismatched, revoked, changed or unauthenticated job before reservation',async()=>{
 for(const [key,value] of [['userId','22222222-2222-4222-8222-222222222222'],['adAccountId','456'],['state','disconnected'],['consent',false],['revision','3']]){
  const f=fixture();f.job[key]=value;assert.equal(await f.adapter.reserve(expected),false);assert.equal(f.calls.length,0);
 }
 const f=fixture();assert.equal(await f.adapter.reserve({...expected,accountId:'456'}),false);assert.equal(f.calls.length,0);
});
test('database replay protection decides concurrent requests and finish failures are not success',async()=>{
 const f=fixture();const results=await Promise.all([f.adapter.reserve(expected),f.adapter.reserve(expected)]);
 assert.deepEqual(results.sort(),[false,true]);
 f.store.finish=async()=>false;
 assert.equal(await f.adapter.finish({...expected,outcome:'uncertain'}),false);
 f.store.finish=async()=>{throw Error('offline')};
 await assert.rejects(()=>f.adapter.finish({...expected,outcome:'uncertain'}));
});
