import test from 'node:test';
import assert from 'node:assert/strict';
import {createClaimPoller} from './scheduled-shadow-claim-poller.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('read-only poll is sequential, bounded, and fails closed on a hung or malformed response',async()=>{
 const timers=[],results=[];let release,calls=0;
 const p=createClaimPoller({inspect:()=>{calls++;return new Promise(r=>{release=r})},onResult:x=>results.push(x),intervalMs:1000,timeoutMs:1000,setTimer:(fn,ms)=>{const x={fn,ms,cleared:false};timers.push(x);return x},clearTimer:x=>{x.cleared=true}});
 assert.equal(p.start(),true);assert.equal(p.start(),false);assert.equal(calls,1);
 timers[0].fn();assert.deepEqual(results,[{status:'unavailable',sequence:1}]);assert.equal(calls,1);
 release({staleClaimed:0,uncertain:0});await flush();assert.deepEqual(results,[{status:'unavailable',sequence:1}]);
 timers.at(-1).fn();assert.equal(calls,2);release({staleClaimed:-1,uncertain:0,secret:'x'});await flush();assert.deepEqual(results.at(-1),{status:'unavailable',sequence:2});
 assert.equal(p.stop(),true);assert.equal(p.stop(),false);assert.equal(JSON.stringify(results).includes('secret'),false);
});
test('late timed-out reply never clears failure; only a fresh successful query does',async()=>{
 const timers=[],results=[];let release,calls=0;
 const p=createClaimPoller({inspect:()=>{calls++;return new Promise(r=>{release=r})},onResult:x=>results.push(x),intervalMs:1000,timeoutMs:1000,setTimer:(fn,ms)=>{const x={fn,ms};timers.push(x);return x},clearTimer:()=>{}});
 p.start();timers[0].fn();assert.equal(calls,1);assert.deepEqual(results,[{status:'unavailable',sequence:1}]);
 release({staleClaimed:0,uncertain:0});await flush();assert.equal(results.length,1);assert.equal(calls,1);
 timers.at(-1).fn();assert.equal(calls,2);release({staleClaimed:0,uncertain:0});await flush();assert.deepEqual(results.at(-1),{status:'ok',unresolved:0,sequence:2});p.stop();
});
test('stopping an in-flight poll ignores the eventual result and never starts a second request',async()=>{
 let release,calls=0;const results=[];const p=createClaimPoller({inspect:()=>{calls++;return new Promise(r=>{release=r})},onResult:x=>results.push(x)});
 p.start();p.stop();assert.equal(p.start(),false);release({staleClaimed:0,uncertain:0});await flush();assert.equal(calls,1);assert.deepEqual(results,[]);
});
