import test from 'node:test';
import assert from 'node:assert/strict';
import {createShadowScheduledSimulation} from './shadow-scheduled-simulation.mjs';
import {createScheduledShadowRunner} from './scheduled-shadow-runner.mjs';
import {createDualDeviceEstimateService} from './dual-device-estimate-service.mjs';
import {createNaverRankEstimate} from './naver-rank-estimate.mjs';
import {scheduledWorkerLog} from './scheduled-shadow-worker.mjs';
import {assessShadowEvent} from './scheduled-shadow-monitor.mjs';

const userId='11111111-1111-4111-8111-111111111111',ruleId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',connectionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',claimId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',entryId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const schedule={timezone:'Asia/Seoul',slots:'1'.repeat(168)};
async function simulate({failureDevice,aboveCap=false,inactive=false,inherited=false}={}){
 const time=Date.now(),slotStartMs=Math.floor(time/3600000)*3600000,history=[],calls=[];
 const row={id:ruleId,connection_id:connectionId,campaign_id:'cmp-1',adgroup_id:'grp-1',target_type:'product',target_id:'nad-1',reference_bid:100,min_bid:50,max_bid:200,max_change:100,pc_position:1,mobile_position:1,version:1,schedule};
 const checkClaim=async()=>({userId,ruleId,ruleVersion:1,connectionId,slotStartMs,schedule});
 const worker=createShadowScheduledSimulation({verifySession:async()=>null,checkClaim,isAccountActive:async()=>true,now:()=>time,appendClaim:async value=>{history.push(value.result);return entryId;},buildReadServices:verify=>{
  const memberAllowed=async id=>id===userId;
  const getBinding=async()=>({userId,customerId:'123',status:'read_connected',revision:1});
  const catalog=async(_token,input)=>({ok:true,items:input.action==='campaigns'?[{id:'cmp-1'}]:input.action==='groups'?[{id:'grp-1',bid:100,status:inactive?'PAUSED':'ELIGIBLE'}]:[{id:'nad-1',bid:100,status:inactive?'PAUSED':'ELIGIBLE',useGroupBid:inherited}]});
  const estimateForCustomer=customerId=>createNaverRankEstimate({apiKey:'mock',secretKey:'mock',customerId,now:()=>time,fetcher:async(url,opts)=>{
   const path=new URL(url).pathname; calls.push({path,method:opts.method});
   assert.equal(opts.method,'POST');assert.equal(path,'/npla-estimate/average-position-bid/id');
   const {device,items:[{key,position}]}=JSON.parse(opts.body);
   if(device===failureDevice)return Response.json({device,estimate:[]});
   return Response.json({device,estimate:[{nccAdId:key,position,bid:aboveCap&&device==='MOBILE'?300:150}]});
  }});
  const rankEstimate=createDualDeviceEstimateService({verifySession:verify,memberAllowed,getBinding,catalog,estimateForCustomer,now:()=>time});
  return {memberAllowed,getBinding,catalog,rankEstimate,compare:async()=>null,preview:async()=>null,store:{save:async()=>null,list:async()=>[row],history:async()=>[]}};
 }});
 const run=createScheduledShadowRunner({now:()=>time,loadCandidates:async()=>[{id:ruleId,version:1,connectionId,schedule}],authorize:async()=>true,claimSlot:async ctx=>({...ctx,claimId}),simulate:worker.simulate,finish:async()=>true});
 const result=await run();assert.equal(result.counts.recorded,1);assert.equal(history.length,1);assert.equal(history[0].execution,'disabled');assert.equal(history[0].status,'shadow_only');assert.equal(calls.length,2);assert.ok(calls.every(call=>call.method==='POST'&&call.path==='/npla-estimate/average-position-bid/id'));
 return {history:history[0],result,event:assessShadowEvent(scheduledWorkerLog(result)),calls};
}
test('either missing device quote is saved as a read failure and triggers monitor',async()=>{for(const failureDevice of ['PC','MOBILE']){const x=await simulate({failureDevice});assert.ok(x.history.blockers.includes('rank_estimate_unavailable'));assert.equal(x.history.proposedBid,null);assert.equal(x.result.counts.dataUnavailable,1);assert.equal(x.event,'run_incomplete')}});
test('above-cap target is saved as a bounded proposal, with a policy blocker but no read failure',async()=>{const x=await simulate({aboveCap:true});assert.ok(x.history.blockers.includes('rank_target_above_cap'));assert.ok(x.history.proposedBid<=200);assert.equal(x.history.rankEstimate.mobile.withinCap,false);assert.equal(x.result.counts.dataUnavailable,0);assert.equal(x.event,'ok')});
test('inactive inherited product is saved as blocked, without falsely classifying it as read failure',async()=>{const x=await simulate({inactive:true,inherited:true});for(const blocker of ['adgroup_inactive','target_inactive','individual_bid_conversion_required'])assert.ok(x.history.blockers.includes(blocker),blocker);assert.equal(x.result.counts.dataUnavailable,0);assert.equal(x.event,'ok')});
