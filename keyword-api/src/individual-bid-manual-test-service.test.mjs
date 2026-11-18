import test from 'node:test';import assert from 'node:assert/strict';
import {createIndividualBidManualTestService} from './individual-bid-manual-test-service.mjs';
import {createNaverIndividualBidAdapter} from './naver-individual-bid-adapter.mjs';
const user='11111111-1111-4111-8111-111111111111',connection='22222222-2222-4222-8222-222222222222',ruleId='33333333-3333-4333-8333-333333333333',requestId='44444444-4444-4444-8444-444444444444';
const base={token:'test-token',requestId,ruleId,desiredBid:80,confirm:true,allowGroupConversion:true};
function fixture({kind='product',enabled=true}={}){
 const rule={id:ruleId,userId:user,connectionId:connection,version:1,kind,groupId:'grp-test',targetId:kind==='product'?'nad-test':'nkw-test',minBid:kind==='product'?50:70,maxBid:200,maxChange:30};
 const binding={id:connection,userId:user,status:'read_connected',revision:2,customerId:'123'};
 const approval={userId:user,connectionId:connection,connectionRevision:2,writeAllowed:true,expiresAt:5000};
 const snapshot={kind,customerId:'123',groupId:rule.groupId,targetId:rule.targetId,bid:null,useGroupBid:true,groupBid:70,observedAt:1000};
 const calls=[],seen=new Set();let writeResult={status:'observed_applied',retry:'disabled',observedBid:80,observedUseGroupBid:false},finishOk=true,time=1000;
 const deps={enabled,now:()=>time,verifyUser:async token=>token==='test-token'?{id:user}:null,loadRule:async()=>rule,loadBinding:async()=>binding,loadApproval:async()=>approval,loadSnapshot:async()=>snapshot,reserve:async item=>{calls.push(['reserve',item]);if(seen.has(item.requestId))return false;seen.add(item.requestId);return true},finish:async item=>{calls.push(['finish',item]);return finishOk},adapterForBinding:async()=>({changeAndVerify:async args=>{calls.push(['write',args]);return writeResult}})};
 return {rule,binding,approval,snapshot,calls,deps,run:input=>createIndividualBidManualTestService(deps).execute({...base,...input}),setWriteResult:x=>{writeResult=x},setFinish:x=>{finishOk=x},setTime:x=>{time=x}};
}
for(const kind of ['product','keyword'])test(`${kind} requires authorized bound account and durable audit before write`,async()=>{const f=fixture({kind});const result=await f.run();assert.equal(result.status,'observed_applied');assert.deepEqual(f.calls.map(x=>x[0]),['reserve','write','finish']);assert.equal(f.calls[1][1].targetId,f.rule.targetId);assert.equal(f.calls[0][1].connectionRevision,2);assert.equal((await f.run()).reason,'reservation_rejected');assert.equal(f.calls.filter(x=>x[0]==='write').length,1)});
test('disabled, non-owner, expired approval and snapshot mismatch fail before reservation',async()=>{
 let f=fixture({enabled:false});assert.equal((await f.run()).reason,'write_disabled');
 f=fixture();assert.equal((await f.run({token:'invalid'})).reason,'unauthenticated');
 f=fixture();f.rule.userId='55555555-5555-4555-8555-555555555555';assert.equal((await f.run()).reason,'rule_unavailable');
 f=fixture();f.approval.expiresAt=1000;assert.equal((await f.run()).reason,'write_approval_required');
 f=fixture();f.snapshot.customerId='456';assert.equal((await f.run()).reason,'snapshot_unavailable');assert.equal(f.calls.length,0);
});
test('bounds, change limits, stale data and conversion consent are enforced before write',async()=>{
 let f=fixture();assert.equal((await f.run({desiredBid:210})).reason,'bid_out_of_bounds');
 f=fixture();assert.equal((await f.run({desiredBid:110})).reason,'change_limit_exceeded');
 f=fixture();assert.equal((await f.run({allowGroupConversion:false})).reason,'conversion_not_authorized');
 f=fixture();f.snapshot.observedAt=1001;assert.equal((await f.run()).reason,'snapshot_unavailable');assert.equal(f.calls.length,0);
});
test('uncertain write and failed final audit never trigger retry',async()=>{
 let f=fixture();f.setWriteResult({status:'unconfirmed',retry:'disabled',observedBid:80,observedUseGroupBid:false});assert.equal((await f.run()).status,'unconfirmed');assert.equal(f.calls.filter(x=>x[0]==='write').length,1);
 f=fixture();f.setFinish(false);assert.equal((await f.run()).status,'audit_unconfirmed');assert.equal(f.calls.filter(x=>x[0]==='write').length,1);
});
test('forged successful adapter results with wrong amount or inheritance are unconfirmed',async()=>{
 for(const bad of [{status:'observed_applied',retry:'disabled',observedBid:90,observedUseGroupBid:false},{status:'observed_applied',retry:'disabled',observedBid:80,observedUseGroupBid:true},{status:'observed_applied',retry:'disabled'}]){const f=fixture();f.setWriteResult(bad);const r=await f.run();assert.equal(r.status,'unconfirmed');assert.equal(f.calls.at(-1)[1].outcome.status,'unconfirmed')}
});
test('revocation, rule and account changes or expired approval after reservation block writes and finish audit',async()=>{
 for(const change of [f=>{f.approval.writeAllowed=false},f=>{f.approval.expiresAt=1000},f=>{f.binding.revision++},f=>{f.rule.version++},f=>{f.rule.maxBid=70},f=>{f.setTime(62000)}]){
  const f=fixture(),reserve=f.deps.reserve;f.deps.reserve=async item=>{const ok=await reserve(item);change(f);return ok};
  const r=await f.run();assert.equal(r.status,'blocked');assert.equal(r.reason,'authorization_changed');assert.equal(f.calls.filter(x=>x[0]==='write').length,0);assert.equal(f.calls.at(-1)[0],'finish');assert.equal(f.calls.at(-1)[1].outcome.reason,'authorization_changed');
 }
});
test('persistent mock reservation prevents concurrent same-request writes and later repeats',async()=>{
 const f=fixture(),service=createIndividualBidManualTestService(f.deps);
 const results=await Promise.all([service.execute(base),service.execute(base)]);
 assert.equal(results.filter(x=>x.status==='observed_applied').length,1);assert.equal(results.filter(x=>x.reason==='reservation_rejected').length,1);
 assert.equal((await service.execute(base)).reason,'reservation_rejected');assert.equal(f.calls.filter(x=>x[0]==='write').length,1);
});
test('composition calls the real provider adapter against an injected mock and re-reads',async()=>{
 const f=fixture(),methods=[];let state={nccAdId:'nad-test',nccAdgroupId:'grp-test',customerId:123,type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:null,useGroupBidAmt:true}};
 f.deps.adapterForBinding=async()=>createNaverIndividualBidAdapter({apiKey:'mock',secretKey:'mock',customerId:'123',writeEnabled:true,fetcher:async(url,opts)=>{methods.push(opts.method);if(opts.method==='PUT')state={...state,adAttr:JSON.parse(opts.body).adAttr};return Response.json(opts.method==='GET'?state:{})}});
 assert.equal((await f.run()).status,'observed_applied');assert.deepEqual(methods,['GET','PUT','GET']);assert.deepEqual(f.calls.map(x=>x[0]),['reserve','finish']);
});
