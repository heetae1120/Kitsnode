import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessShadowEvent,createShadowMonitor} from './scheduled-shadow-monitor.mjs';
const good=counts=>({event:'scheduled_shadow',status:'completed',execution:'disabled',counts:{invalid:0,unauthorized:0,skipped:0,uncertain:0,recordUnknown:0,dataUnavailable:0,unresolved:0,...counts}});
test('detects incomplete work even on completed run',()=>{
 for(const key of ['invalid','unauthorized','skipped','uncertain','recordUnknown','dataUnavailable','unresolved'])assert.equal(assessShadowEvent(good({recorded:2,[key]:1})),'run_incomplete');
 assert.equal(assessShadowEvent(good({recorded:2,duplicate:1})),'ok');
 assert.equal(assessShadowEvent({event:'scheduled_shadow',status:'unavailable',execution:'disabled'}),'worker_unavailable');
 assert.equal(assessShadowEvent(good({invalid:-1})),'invalid_event');
});
test('detects startup and subsequent stalled results without alert storms',()=>{
 let time=0;const alerts=[];const monitor=createShadowMonitor({now:()=>time,alert:e=>alerts.push(e),initialTimeoutMs:10,intervalTimeoutMs:20});
 time=11;assert.equal(monitor.check(),false);monitor.check();assert.equal(alerts.length,1);
 monitor.result(good({recorded:1}));time=32;assert.equal(monitor.check(),false);assert.equal(alerts.length,2);
 assert.deepEqual(alerts.map(x=>x.code),['result_overdue','result_overdue']);
});
test('separate claim health fails closed on unresolved, malformed, overdue and cannot hide a failed run',()=>{
 let t=0;const alerts=[];const m=createShadowMonitor({now:()=>t,alert:x=>alerts.push(x),requireClaimCheck:true,claimTimeoutMs:100});
 m.result(good({}));assert.equal(m.isHealthy(),false);
 let seq=0;const claim=n=>{seq++;m.claimStart({event:'scheduled_claim_started',sequence:seq,execution:'disabled'});return {event:'scheduled_claim_monitor',status:'ok',execution:'disabled',sequence:seq,unresolved:n}};
 m.claimResult(claim(0));assert.equal(m.isHealthy(),true);
 m.claimResult(claim(1));assert.equal(m.isHealthy(),false);m.result(good({}));assert.equal(m.isHealthy(),false);
 m.claimResult(claim(0));assert.equal(m.isHealthy(),true);m.result(good({dataUnavailable:1}));m.claimResult(claim(0));assert.equal(m.isHealthy(),false);
 m.result(good({unresolved:1}));assert.equal(m.isHealthy(),false);m.claimResult(claim(0));assert.equal(m.isHealthy(),true);
 m.result(good({}));m.claimResult({...claim(0),execution:'enabled'});assert.equal(m.isHealthy(),false);
 m.claimResult(claim(0));t=101;assert.equal(m.check(),false);assert.equal(m.isHealthy(),false);
 assert.ok(alerts.some(x=>x.code==='unresolved_claims'));assert.ok(alerts.some(x=>x.code==='claim_check_overdue'));
});
test('a poll that started before a scheduled unresolved result cannot clear it after that result',()=>{
 const m=createShadowMonitor({requireClaimCheck:true});const start=n=>m.claimStart({event:'scheduled_claim_started',execution:'disabled',sequence:n});const done=n=>m.claimResult({event:'scheduled_claim_monitor',execution:'disabled',status:'ok',sequence:n,unresolved:0});
 m.result(good({}));start(1);done(1);assert.equal(m.isHealthy(),true);
 start(2);m.result(good({unresolved:1}));done(2);assert.equal(m.isHealthy(),false);
 start(3);done(3);assert.equal(m.isHealthy(),true);
});
