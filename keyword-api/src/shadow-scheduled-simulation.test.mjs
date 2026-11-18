import test from 'node:test';
import assert from 'node:assert/strict';
import {createShadowSystemPrincipal} from './shadow-system-principal.mjs';
import {createShadowScheduledSimulation} from './shadow-scheduled-simulation.mjs';
import {createScheduledShadowRunner} from './scheduled-shadow-runner.mjs';
const userId='11111111-1111-4111-8111-111111111111',ruleId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',claimId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',entryId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const on={timezone:'Asia/Seoul',slots:'1'.repeat(168)};
const start=Math.floor(Date.now()/3600000)*3600000;
const context={ruleId,ruleVersion:1,connectionId,slotStartMs:start,claimId};
const validClaim=()=>({userId,ruleId,ruleVersion:1,connectionId,slotStartMs:start,schedule:on});
test('private capabilities cannot be forged, escaped or reused after a single simulation',async()=>{
 let captured,principal;const checks=[];
 principal=createShadowSystemPrincipal({isAccountActive:async()=>true,verifySession:async t=>t==='member'?{id:userId}:null,checkClaim:async c=>{checks.push(c);return validClaim()},now:()=>start+1000,runShadow:async(token,input)=>{captured=token;assert.deepEqual(input,{action:'simulate',connectionId,ruleId});assert.deepEqual(await principal.verifySession(token),{id:userId});return {ok:true,entryId,result:{status:'shadow_only',execution:'disabled',scheduleEvaluation:{status:'on'}}}}});
 assert.deepEqual(await principal.verifySession('member'),{id:userId});assert.equal(await principal.verifySession({}),null);
 assert.equal((await principal.simulateClaim(context)).entryId,entryId);assert.equal(await principal.verifySession(captured),null);assert.ok(checks.length>=2);
 assert.equal((await principal.simulateClaim({...context,enabled:true})).status,'unavailable');
});
test('revocation, changed identity, stale version, OFF schedule and expired hour fail closed',async()=>{
 for(const changed of [null,{...validClaim(),userId:'bad'},{...validClaim(),ruleVersion:2},{...validClaim(),schedule:{...on,slots:'0'.repeat(168)}}]){
  let calls=0;const principal=createShadowSystemPrincipal({isAccountActive:async()=>true,verifySession:async()=>null,checkClaim:async()=>changed,now:()=>start+1000,runShadow:async()=>{calls++;return null}});
  assert.equal((await principal.simulateClaim(context)).status,'unavailable');assert.equal(calls,0);
 }
 const expired=createShadowSystemPrincipal({isAccountActive:async()=>true,verifySession:async()=>null,checkClaim:async()=>validClaim(),now:()=>start+3600000,runShadow:async()=>{throw Error('called')}});assert.equal((await expired.simulateClaim(context)).status,'unavailable');
 let calls=0,tokenSeen;const p=createShadowSystemPrincipal({isAccountActive:async()=>true,verifySession:async()=>null,checkClaim:async()=>++calls===1?validClaim():null,now:()=>start+1000,runShadow:async token=>{tokenSeen=token;assert.equal(await p.verifySession(token),null);return {ok:false}}});assert.equal((await p.simulateClaim(context)).status,'unavailable');assert.equal(await p.verifySession(tokenSeen),null);
});
test('runner drives real shadow service through claimed system principal and atomic-append contract',async()=>{
 let stored=[],claimLive=true,allowed=true;
 const row={id:ruleId,connection_id:connectionId,campaign_id:'cmp-1',adgroup_id:'grp-1',target_type:'product',target_id:'nad-1',reference_bid:60,min_bid:50,max_bid:1000,max_change:20,version:1,schedule:on};
 const checkClaim=async()=>claimLive&&allowed?validClaim():null;
 const worker=createShadowScheduledSimulation({isAccountActive:async()=>true,verifySession:async()=>null,checkClaim,now:()=>start+1000,appendClaim:async input=>{assert.equal(input.claimId,claimId);assert.equal(input.userId,userId);assert.equal(input.connectionRevision,3);if(!claimLive||!allowed)return null;stored.push(input.result);return entryId},buildReadServices:verify=>({memberAllowed:async id=>allowed&&id===userId,getBinding:async(id,cid)=>id===userId&&cid===connectionId?{userId,status:'read_connected',revision:3}:null,catalog:async(token,request)=>{if(!(await verify(token)))return {ok:false};return {ok:true,items:request.action==='groups'?[{id:'grp-1',bid:50,status:'ELIGIBLE'}]:[{id:'nad-1',bid:50,status:'ELIGIBLE',useGroupBid:false}]}},compare:async()=>null,preview:async()=>null,store:{save:async()=>null,list:async()=>[row],history:async()=>[]}})});
 const finished=[];const run=createScheduledShadowRunner({now:()=>start+1000,loadCandidates:async()=>[{id:ruleId,version:1,connectionId,schedule:on}],authorize:async()=>allowed,claimSlot:async x=>({...x,claimId}),simulate:worker.simulate,finish:async x=>{finished.push(x);return true}});
 const result=await run();assert.equal(result.counts.recorded,1);assert.equal(stored.length,1);assert.equal(stored[0].execution,'disabled');assert.equal(stored[0].trigger,'scheduled');assert.equal(stored[0].scheduleEvaluation.status,'on');assert.equal(finished[0].state,'recorded');
 allowed=false;assert.equal((await worker.simulate(context)).status,'unavailable');assert.equal(stored.length,1);
});

test('unavailable, deleted, disabled or banned users cannot receive a background identity',async()=>{for(const account of [false,null,undefined]){let called=0;const worker=createShadowSystemPrincipal({verifySession:async()=>null,checkClaim:async()=>validClaim(),isAccountActive:async()=>account,now:()=>start+1000,runShadow:async()=>{called++;return null}});assert.equal((await worker.simulateClaim(context)).status,'unavailable');assert.equal(called,0)}const worker=createShadowSystemPrincipal({verifySession:async()=>null,checkClaim:async()=>validClaim(),isAccountActive:async()=>{throw Error('auth unavailable')},now:()=>start+1000,runShadow:async()=>{throw Error('called')}});assert.equal((await worker.simulateClaim(context)).status,'unavailable')});

test('recorded read failures propagate only a bounded aggregate without paused-ad false positives',async()=>{
 for(const [blockers,expected] of [
  [['rank_estimate_unavailable','adgroup_inactive'],true],
  [['snapshot_invalid'],true],
  [['snapshot_stale'],true],
  [['current_bid_unavailable'],true],
  [['adgroup_inactive','target_inactive','individual_bid_conversion_required','atomic_update_unavailable','write_permission_unverified'],false]
 ]){
  const principal=createShadowSystemPrincipal({verifySession:async()=>null,checkClaim:async()=>validClaim(),isAccountActive:async()=>true,now:()=>start+1000,runShadow:async()=>({ok:true,entryId,result:{status:'shadow_only',execution:'disabled',scheduleEvaluation:{status:'on'},blockers}})});
  const output=await principal.simulateClaim(context);
  assert.equal(output.entryId,entryId);assert.equal(output.dataUnavailable,expected);
  assert.equal(Object.hasOwn(output,'blockers'),false);assert.equal(Object.hasOwn(output,'userId'),false);
  const runner=createScheduledShadowRunner({now:()=>start+1000,loadCandidates:async()=>[{id:ruleId,version:1,connectionId,schedule:on}],authorize:async()=>true,claimSlot:async x=>({...x,claimId}),simulate:principal.simulateClaim,finish:async()=>true});
  const result=await runner();assert.equal(result.counts.recorded,1);assert.equal(result.counts.dataUnavailable,expected?1:0);
 }
});
