import test from 'node:test';
import assert from 'node:assert/strict';
import {createRankObservationTracking,recordRankObservation,summarizeRankObservationTracking} from './rank-observation-tracker.mjs';
const start=1_800_000_000_000;
const fresh=()=>createRankObservationTracking({id:'sim-1',changeAt:start,bid:100,targets:{pc:2,mobile:3}});
const record=(s,minutes,device,result,delay=0)=>recordRankObservation(s,{minutes,device,requestedAt:start+minutes*60000,receivedAt:start+minutes*60000+delay,result});
const instant=(rank,at)=>({status:'available',kind:'instant',rank,observedAt:at,source:'fixture'});
test('10/20/30 minute simulation keeps device measurements separate and reports bounded target interval',()=>{
 let s=fresh();
 s=record(s,10,'pc',instant(4,start+600000));s=record(s,20,'pc',instant(2,start+1200000));
 s=record(s,10,'mobile',instant(2,start+600000));s=record(s,30,'mobile',instant(3,start+1800000));
 const out=summarizeRankObservationTracking(s);
 assert.deepEqual(out.pc.firstObservedTarget,{observedAt:start+1200000,lowerBoundMs:600000,upperBoundMs:1200000,classification:'observed_interval_not_causal'});
 assert.equal(out.mobile.firstObservedTarget.upperBoundMs,600000);assert.equal(out.mobile.firstObservedTarget.lowerBoundMs,null);assert.equal(out.pc.checkpoints[2].status,'pending');
});
test('out-of-order late retries are evaluated by observation time, not checkpoint number',()=>{
 let s=fresh();s=record(s,10,'pc',instant(1,start+1500000),900000);s=record(s,20,'pc',instant(3,start+1200000));
 const first=summarizeRankObservationTracking(s).pc.firstObservedTarget;
 assert.equal(first.lowerBoundMs,1200000);assert.equal(first.upperBoundMs,1500000);
});
test('estimate, stale data and failed readings do not fabricate positions; later retry can succeed',()=>{
 let s=fresh();s=record(s,10,'pc',{status:'available',kind:'estimate',rank:1,observedAt:start+600000,source:'estimate'});
 assert.equal(s.checkpoints[0].status,'unavailable');assert.equal(s.checkpoints[0].attempts[0].reason,'invalid_or_stale_observation');
 s=record(s,10,'pc',instant(1,start+599999));assert.equal(s.checkpoints[0].status,'unavailable');
 s=record(s,10,'pc',instant(2,start+720000),120000);assert.equal(s.checkpoints[0].status,'observed');assert.equal(s.checkpoints[0].attempts[2].late,true);
 assert.throws(()=>record(s,10,'pc',instant(1,start+600000)),/checkpoint_complete/);
});
test('aggregate rank keeps its window and cannot claim instant target or propagation time',()=>{
 let s=fresh();s=record(s,20,'pc',{status:'available',kind:'average',rank:1.5,windowStart:start,windowEnd:start+1200000,source:'stats'});
 const out=summarizeRankObservationTracking(s);assert.equal(out.pc.checkpoints[1].observation.kind,'average');assert.equal(out.pc.firstObservedTarget,null);
 s=record(s,10,'mobile',{status:'available',kind:'average',rank:2,windowStart:start-1,windowEnd:start+600000,source:'stats'});assert.equal(summarizeRankObservationTracking(s).mobile.checkpoints[0].status,'unavailable');
});
test('a reporting window ending before the checkpoint is stale, not a measurement of the checkpoint',()=>{
 let s=fresh();s=record(s,20,'pc',{status:'available',kind:'average',rank:1,windowStart:start,windowEnd:start+300000,source:'stats'});
 const cp=summarizeRankObservationTracking(s).pc.checkpoints[1];
 assert.equal(cp.status,'unavailable');assert.equal(cp.observation,null);
 assert.equal(s.checkpoints.find(x=>x.device==='pc'&&x.minutes===20).attempts[0].reason,'invalid_or_stale_observation');
});
test('only simulated changes allowed; invalid time, dimensions, prices or future readings are rejected',()=>{
 assert.throws(()=>createRankObservationTracking({id:'a',changeAt:start,bid:100,targets:{pc:1,mobile:1},mode:'live'}),/invalid_tracking/);
 const s=fresh();assert.throws(()=>recordRankObservation(s,{minutes:10,device:'pc',requestedAt:start,receivedAt:start,result:{}}),/invalid_observation_attempt/);
 const r=record(s,10,'pc',instant(1,start+600001));assert.equal(r.checkpoints[0].status,'unavailable');
 assert.equal(s.checkpoints[0].status,'pending');
});
