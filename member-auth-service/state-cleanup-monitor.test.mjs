import test from 'node:test';
import assert from 'node:assert/strict';
import {createMonitoredCleanup} from './state-cleanup-monitor.mjs';

const env = {STATE_CLEANUP_MONITOR_URL:'https://hc-ping.com/00000000-0000-0000-0000-000000000000'};
test('reports success only after successful cleanup', async () => {
  const events=[];
  const worker=createMonitoredCleanup({cleanup:{scheduled:async()=>events.push('cleanup')},send:async (url)=>{events.push(url);return {ok:true}}});
  await worker.scheduled({},env);
  assert.deepEqual(events,['cleanup',env.STATE_CLEANUP_MONITOR_URL]);
});
test('reports cleanup failure and never sends success', async () => {
  const events=[];
  const worker=createMonitoredCleanup({cleanup:{scheduled:async()=>{throw Error('secret')}},send:async url=>{events.push(url);return {ok:true}}});
  await assert.rejects(worker.scheduled({},env),/State cleanup failed/);
  assert.deepEqual(events,[`${env.STATE_CLEANUP_MONITOR_URL}/fail`]);
});
test('rejects untrusted monitor URL and reports unavailable monitoring', async () => {
  let ran=false;
  const worker=createMonitoredCleanup({cleanup:{scheduled:async()=>{ran=true}},send:async()=>({ok:false})});
  await assert.rejects(worker.scheduled({},{STATE_CLEANUP_MONITOR_URL:'https://example.com/x'}));
  assert.equal(ran,false);
  await assert.rejects(worker.scheduled({},env),/Cleanup monitoring failed/);
  assert.equal((await worker.fetch()).status,404);
});
