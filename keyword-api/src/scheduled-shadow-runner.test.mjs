import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduledShadowRunner} from './scheduled-shadow-runner.mjs';
const rid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',claimId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',entryId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const start=Date.parse('2026-11-15T15:00:00.000Z'),on={timezone:'Asia/Seoul',slots:'1'.repeat(168)},off={...on,slots:'0'.repeat(168)};
const rule={id:rid,version:2,connectionId:cid,schedule:on};
function setup(options={}){
 let clock=start+1234,authCalls=0,simulated=0,claims=0;const keys=new Set(),finished=[];
 const run=createScheduledShadowRunner({now:()=>clock,limit:options.limit??100,loadCandidates:async()=>options.rules??[rule],authorize:async()=>{authCalls++;return options.authorize?options.authorize(authCalls):true},claimSlot:async ctx=>{claims++;if(options.afterClaim)clock=options.afterClaim;const key=`${ctx.ruleId}:${ctx.slotStartMs}`;if(keys.has(key))return {status:!options.finish&&finished.some(f=>f.ruleId===ctx.ruleId&&f.state==='recorded')?'already_recorded':'unresolved'};keys.add(key);return {...ctx,claimId}},simulate:async ctx=>{simulated++;return options.simulate?options.simulate(ctx):{status:'shadow_only',execution:'disabled',entryId}},finish:async ctx=>{finished.push(ctx);return options.finish?options.finish(ctx):true}});
 return {run,finished,keys,counts:()=>({authCalls,simulated,claims})};
}
test('hourly ON slot records a disabled simulation with an explicit claim',async()=>{
 const x=setup(),r=await x.run();assert.equal(r.status,'completed');assert.equal(r.execution,'disabled');assert.equal(r.slotStartMs,start);assert.equal(r.counts.recorded,1);assert.equal(x.finished[0].entryId,entryId);assert.equal(x.finished[0].state,'recorded');assert.equal(x.counts().simulated,1);
});
test('OFF, unset, malformed and unauthorized schedules never claim or simulate',async()=>{
 for(const schedule of [off,null,{...on,timezone:'UTC'}]){const x=setup({rules:[{...rule,schedule}]});const r=await x.run();assert.equal(r.counts.recorded,0);assert.equal(x.counts().claims,0);assert.equal(x.counts().simulated,0)}
 const x=setup({authorize:()=>false});const r=await x.run();assert.equal(r.counts.unauthorized,1);assert.equal(x.counts().claims,0);
});
test('concurrent invocations deduplicate with the durable atomic claim contract',async()=>{
 const x=setup();const results=await Promise.all([x.run(),x.run(),x.run()]);assert.equal(results.reduce((n,r)=>n+r.counts.recorded,0),1);assert.equal(x.counts().simulated,1);assert.equal(x.finished.length,1);
});
test('authorization revoked or hour expires after claim is recorded as skipped',async()=>{
 const revoked=setup({authorize:count=>count===1});const a=await revoked.run();assert.equal(a.counts.skipped,1);assert.equal(revoked.finished[0].reason,'authorization_changed');assert.equal(revoked.counts().simulated,0);
 const expired=setup({afterClaim:start+3600000});const b=await expired.run();assert.equal(b.counts.skipped,1);assert.equal(expired.finished[0].reason,'hour_expired');assert.equal(expired.counts().simulated,0);
});
test('invalid or ambiguous simulation and persistence failure never retry the claim',async()=>{
 for(const simulate of [()=>({status:'success',execution:'enabled',entryId}),()=>{throw Error('lost response')}]){
  const x=setup({simulate});const first=await x.run(),second=await x.run();assert.equal(first.counts.uncertain,1);assert.equal(second.counts.unresolved,1);assert.equal(x.counts().simulated,1);assert.equal(x.finished[0].state,'uncertain');
 }
 const x=setup({finish:()=>false});const first=await x.run(),second=await x.run();assert.equal(first.counts.recordUnknown,1);assert.equal(second.counts.unresolved,1);assert.equal(x.counts().simulated,1);
});
test('limits, malformed snapshots and duplicate candidates fail closed',async()=>{
 const x=setup({limit:1,rules:[rule,rule]});assert.equal((await x.run()).reason,'invalid_candidates');assert.equal(x.counts().claims,0);
 const y=setup({rules:[rule,rule,{...rule,id:'invalid'}]});const result=await y.run();assert.equal(result.counts.recorded,1);assert.equal(result.counts.duplicate,1);assert.equal(result.counts.invalid,1);
 assert.throws(()=>createScheduledShadowRunner(),TypeError);
});
test('DB clock mismatch retries only read lookup and executes once when clocks agree',async()=>{
 let clock=start,loads=0,simulations=0,waits=[];const done=[];
 const runner=createScheduledShadowRunner({now:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms},loadCandidates:async()=>++loads<=2?{status:'clock_mismatch'}:[rule],authorize:async()=>true,claimSlot:async ctx=>({...ctx,claimId}),simulate:async()=>{simulations++;return {status:'shadow_only',execution:'disabled',entryId}},finish:async outcome=>{done.push(outcome);return true}});
 const result=await runner();assert.equal(result.status,'completed');assert.equal(result.counts.recorded,1);assert.equal(loads,3);assert.deepEqual(waits,[2000,4000]);assert.equal(simulations,1);assert.equal(done.length,1);
});
test('continued mismatch is unavailable and never claims; empty candidates are not retried',async()=>{
 let clock=start,loads=0,claims=0;const waits=[];
 const base={now:()=>clock,wait:async ms=>{waits.push(ms);clock+=ms},authorize:async()=>true,claimSlot:async()=>{claims++;return null},simulate:async()=>null,finish:async()=>true};
 const mismatch=createScheduledShadowRunner({...base,loadCandidates:async()=>{loads++;return {status:'clock_mismatch'}}});
 const failed=await mismatch();assert.equal(failed.status,'unavailable');assert.equal(failed.reason,'clock_mismatch');assert.equal(loads,4);assert.deepEqual(waits,[2000,4000,8000]);assert.equal(claims,0);
 loads=0;waits.length=0;const empty=createScheduledShadowRunner({...base,loadCandidates:async()=>{loads++;return []}});const emptyResult=await empty();assert.equal(emptyResult.status,'completed');assert.equal(emptyResult.counts.considered,0);assert.equal(loads,1);assert.deepEqual(waits,[]);
});
test('clock boundary, provider error and wait failure fail closed before claiming',async()=>{
 let clock=start+3599000,claims=0;const base={now:()=>clock,authorize:async()=>true,claimSlot:async()=>{claims++;return null},simulate:async()=>null,finish:async()=>true};
 const expired=createScheduledShadowRunner({...base,loadCandidates:async()=>({status:'clock_mismatch'}),wait:async ms=>{clock+=ms}});
 assert.equal((await expired()).reason,'hour_expired');assert.equal(claims,0);
 clock=start;const loadFailure=createScheduledShadowRunner({...base,loadCandidates:async()=>{throw Error('offline')},wait:async()=>{throw Error('unexpected wait')}});
 assert.equal((await loadFailure()).reason,'load_failed');assert.equal(claims,0);
 const sleepFailure=createScheduledShadowRunner({...base,loadCandidates:async()=>({status:'clock_mismatch'}),wait:async()=>{throw Error('timer failure')}});
 assert.equal((await sleepFailure()).reason,'wait_failed');assert.equal(claims,0);
});
const pageId=i=>`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`;
function pageRule(i){return {...rule,id:pageId(i)}}
function paginationSetup({pages,limit=2,now=()=>start,wait=async()=>{}}){
 let calls=0,claims=0,sims=0;const cursors=[],seen=new Set();
 const runner=createScheduledShadowRunner({limit,now,wait,loadCandidates:async ctx=>{cursors.push(ctx.afterId);return typeof pages==='function'?pages(ctx,++calls):pages[calls++]},authorize:async()=>true,claimSlot:async ctx=>{claims++;const key=`${ctx.ruleId}:${ctx.slotStartMs}`;if(seen.has(key))return {status:'already_recorded'};seen.add(key);return {...ctx,claimId}},simulate:async()=>{sims++;return {status:'shadow_only',execution:'disabled',entryId}},finish:async()=>true});
 return {runner,cursors,stats:()=>({calls,claims,sims})};
}
test('keyset pages above 100 candidates are collected then claimed once each',async()=>{
 const rows=Array.from({length:205},(_,i)=>pageRule(i+1));
 const x=paginationSetup({limit:100,pages:({limit,afterId})=>{const startIndex=afterId?rows.findIndex(r=>r.id===afterId)+1:0;const items=rows.slice(startIndex,startIndex+limit);return {status:'ok',items,nextCursor:startIndex+limit<rows.length?items.at(-1).id:null}}});
 const first=await x.runner(),second=await x.runner();assert.equal(first.status,'completed');assert.equal(first.counts.recorded,205);assert.equal(second.counts.duplicate,205);assert.equal(x.stats().claims,410);assert.equal(x.stats().sims,205);assert.deepEqual(x.cursors.slice(0,3),[null,pageId(100),pageId(200)]);
});
test('invalid page sequence fails before any claim or simulation',async()=>{
 const cases=[
  [{status:'ok',items:[pageRule(2),pageRule(1)],nextCursor:null}],
  [{status:'ok',items:[pageRule(1),pageRule(2)],nextCursor:pageId(2)},{status:'ok',items:[pageRule(2),pageRule(3)],nextCursor:null}],
  [{status:'ok',items:[pageRule(1),pageRule(2)],nextCursor:pageId(1)}],
  [{status:'ok',items:[],nextCursor:pageId(1)}],
  [{status:'ok',items:[pageRule(1)],nextCursor:pageId(1)}],
  [{status:'ok',items:[{...pageRule(1),id:'bad'}],nextCursor:null}]
 ];
 for(const pages of cases){const x=paginationSetup({pages});const r=await x.runner();assert.equal(r.reason,'invalid_candidates');assert.equal(x.stats().claims,0);assert.equal(x.stats().sims,0)}
});
test('bounded page cap fails closed without processing earlier pages',async()=>{
 const x=paginationSetup({limit:1,pages:({afterId})=>{const i=afterId?parseInt(afterId.slice(-12),16)+1:1;return {status:'ok',items:[pageRule(i)],nextCursor:pageId(i)}}});
 const result=await x.runner();assert.equal(result.reason,'candidate_limit');assert.equal(x.stats().calls,100);assert.equal(x.stats().claims,0);
});
test('page failure or hour change leaves all candidates unclaimed',async()=>{
 let clock=start;const x=paginationSetup({now:()=>clock,pages:(_ctx,n)=>{if(n===1)return {status:'ok',items:[pageRule(1),pageRule(2)],nextCursor:pageId(2)};clock+=3600000;return {status:'ok',items:[pageRule(3)],nextCursor:null}}});
 assert.equal((await x.runner()).reason,'hour_expired');assert.equal(x.stats().claims,0);
 const y=paginationSetup({pages:(_ctx,n)=>{if(n===1)return {status:'ok',items:[pageRule(1),pageRule(2)],nextCursor:pageId(2)};throw Error('offline')}});assert.equal((await y.runner()).reason,'load_failed');assert.equal(y.stats().claims,0);
});
test('typed claim outcomes distinguish completed duplicates, unresolved claims and authorization rejection',async()=>{
 for(const [claim,field] of [[{status:'already_recorded'},'duplicate'],[{status:'already_skipped'},'duplicate'],[{status:'already_resolved'},'duplicate'],[{status:'in_progress'},'inProgress'],[{status:'unresolved'},'unresolved'],[{status:'rejected'},'unauthorized'],[null,'uncertain']]){
  let simulations=0;const runner=createScheduledShadowRunner({now:()=>start,loadCandidates:async()=>[rule],authorize:async()=>true,claimSlot:async()=>claim,simulate:async()=>{simulations++;},finish:async()=>true});
  const result=await runner();assert.equal(result.counts[field],1);assert.equal(simulations,0);
 }
});
test('outstanding claim inspection alerts without retry and fails closed if unavailable or malformed',async()=>{
 let claims=0;const base={now:()=>start,loadCandidates:async()=>[],authorize:async()=>true,claimSlot:async()=>{claims++;},simulate:async()=>null,finish:async()=>true};
 const pending=createScheduledShadowRunner({...base,inspectUnresolved:async()=>({staleClaimed:1,uncertain:2})});
 assert.equal((await pending()).counts.unresolved,3);assert.equal(claims,0);
 for(const inspectUnresolved of [async()=>{throw Error('offline')},async()=>({staleClaimed:-1,uncertain:0}),async()=>({staleClaimed:0})]){
  const runner=createScheduledShadowRunner({...base,inspectUnresolved});const result=await runner();assert.equal(result.reason,'unresolved_check_failed');assert.equal(result.execution,'disabled');
 }
});
