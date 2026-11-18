import test from 'node:test';
import assert from 'node:assert/strict';
import {runRankTrackingDemo} from '../src/lib/rank-tracking-demo.mjs';

test('demo uses separate simulated device checkpoints with an explicit unavailable result',()=>{
 const result=runRankTrackingDemo({pcTarget:2,mobileTarget:3});
 assert.deepEqual(result.pc.checkpoints.map(point=>point.observation?.rank),[4,2,1]);
 assert.deepEqual(result.mobile.checkpoints.map(point=>point.observation?.rank??null),[5,null,2]);
 assert.equal(result.mobile.checkpoints[1].status,'unavailable');
 assert.equal(result.pc.firstObservedTarget?.lowerBoundMs,600000);
 assert.equal(result.pc.firstObservedTarget?.upperBoundMs,1200000);
 assert.equal(result.mobile.firstObservedTarget?.lowerBoundMs,600000);
 assert.equal(result.mobile.firstObservedTarget?.upperBoundMs,1800000);
 assert.equal(result.pc.firstObservedTarget?.classification,'observed_interval_not_causal');
});

test('target controls change the result without turning missing data into an observation',()=>{
 const result=runRankTrackingDemo({pcTarget:1,mobileTarget:1});
 assert.equal(result.pc.firstObservedTarget?.upperBoundMs,1800000);
 assert.equal(result.mobile.firstObservedTarget,null);
 assert.equal(result.mobile.checkpoints[1].observation,null);
});
