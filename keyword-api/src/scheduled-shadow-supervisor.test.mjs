import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {spawnSync} from 'node:child_process';
import {startSupervisor} from './scheduled-shadow-supervisor.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const event=counts=>JSON.stringify({event:'scheduled_shadow',status:'completed',execution:'disabled',counts:{invalid:0,unauthorized:0,skipped:0,uncertain:0,recordUnknown:0,dataUnavailable:0,unresolved:0,...counts}})+'\n';
const claimEvent=(unresolved,sequence=1)=>JSON.stringify({event:'scheduled_claim_started',sequence,execution:'disabled'})+'\n'+JSON.stringify({event:'scheduled_claim_monitor',status:'ok',execution:'disabled',sequence,unresolved})+'\n';
test('disabled supervisor does not launch or publish',()=>{
 assert.equal(startSupervisor({env:{},spawnWorker:()=>{throw Error('launched')},adapterFactory:()=>{throw Error('connected')}}).status,'disabled');
});
test('enabled supervisor refuses a missing or incorrect monitored marker path',()=>{
 for(const path of [undefined,'','/tmp/healthy','/run/kits-shadow/other']){
  let spawned=false;assert.throws(()=>startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:path},spawnWorker:()=>{spawned=true}}),/invalid_health_marker_configuration/);assert.equal(spawned,false);
 }
});
test('periodic health holds failed state until a successful result and strips cloud secrets from worker',async()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{};const timers=[];const metrics=[];const logs=[];let time=0,workerEnv;
 const supervisor=startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy',NCP_CLOUD_INSIGHT_SECRET_KEY:'secret',NCP_CLOUD_INSIGHT_ACCESS_KEY:'access',NCP_CLOUD_INSIGHT_CW_KEY:'product'},now:()=>time,spawnWorker:(_,__,opts)=>{workerEnv=opts.env;return child},markerFactory:()=>({sync:()=>true}),write:x=>logs.push(x),setIntervalFn:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearIntervalFn:()=>{},adapterFactory:()=>({status:'ready',publish:async x=>{metrics.push(x);return {status:'sent'}}})});
 await flush();assert.deepEqual(metrics,[{healthy:false}]);assert.equal(workerEnv.NCP_CLOUD_INSIGHT_SECRET_KEY,undefined);
 const tick=timers.find(t=>t.ms===60000).fn;
 child.stdout.emit('data',event({}));child.stdout.emit('data',claimEvent(0));tick();await flush();assert.equal(metrics.at(-1).healthy,true);
 child.stdout.emit('data',event({dataUnavailable:1}));tick();await flush();assert.equal(metrics.at(-1).healthy,false);
 tick();await flush();assert.equal(metrics.at(-1).healthy,false);
 child.stdout.emit('data',event({}));tick();await flush();assert.equal(metrics.at(-1).healthy,true);
 time=4500001;tick();await flush();assert.equal(metrics.at(-1).healthy,false);
 assert.equal(JSON.stringify(logs).includes('secret'),false);supervisor.stop();
});
test('delivery errors give fixed safe alert without halting process and recovery allows future alert',async()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{};const timers=[],logs=[];let ok=false;
 const s=startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},spawnWorker:()=>child,markerFactory:()=>({sync:()=>true}),write:x=>logs.push(x),setIntervalFn:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearIntervalFn:()=>{},adapterFactory:()=>({status:'ready',publish:async()=>{if(!ok)throw Error('credentials leaked');return {status:'sent'}}})});
 await flush();const tick=timers.find(t=>t.ms===60000).fn;tick();await flush();assert.equal(logs.length,1);assert.equal(logs[0].code,'metrics_delivery_failed');
 ok=true;tick();await flush();ok=false;tick();await flush();assert.equal(logs.length,2);assert.equal(JSON.stringify(logs).includes('credentials'),false);s.stop();
});
test('logs only validated successful results without copying worker data',()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{};const logs=[];
 const supervisor=startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},spawnWorker:()=>child,markerFactory:()=>({sync:()=>true}),write:x=>logs.push(x),setIntervalFn:()=>({}),clearIntervalFn:()=>{},adapterFactory:()=>({status:'disabled'})});
 const successful=JSON.parse(event({}));successful.customerId='sensitive-identity';successful.extra='secret-value';
 const line=JSON.stringify(successful)+'\n';child.stdout.emit('data',line.slice(0,15));assert.equal(logs.length,0);child.stdout.emit('data',line.slice(15));
 assert.deepEqual(logs,[{event:'shadow_monitor_success',execution:'disabled'}]);
 child.stdout.emit('data',event({dataUnavailable:1}));assert.equal(logs.filter(x=>x.event==='shadow_monitor_success').length,1);
 assert.equal(JSON.stringify(logs).includes('sensitive-identity'),false);assert.equal(JSON.stringify(logs).includes('secret-value'),false);supervisor.stop();
});
test('health marker tracks only valid completed runs and is removed on timeout and stop',()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>{};const markers=[],timers=[];let time=0;
 const supervisor=startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},now:()=>time,spawnWorker:()=>child,markerFactory:({path})=>{assert.equal(path,'/run/kits-shadow/healthy');return {sync:value=>{markers.push(value);return true}}},setIntervalFn:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer},clearIntervalFn:()=>{},adapterFactory:()=>({status:'disabled'})});
 assert.deepEqual(markers,[false]);child.stdout.emit('data',event({}));assert.equal(markers.at(-1),false);child.stdout.emit('data',claimEvent(0));assert.equal(markers.at(-1),true);
 child.stdout.emit('data',event({dataUnavailable:1}));assert.equal(markers.at(-1),false);
 child.stdout.emit('data',event({}));assert.equal(markers.at(-1),true);
 time=4500001;timers.find(x=>x.ms===30000).fn();assert.equal(markers.at(-1),false);
 supervisor.stop();assert.equal(markers.at(-1),false);
});
test('marker failure at startup aborts before spawning a worker',()=>{
 const logs=[];let spawned=false;
 assert.throws(()=>startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},spawnWorker:()=>{spawned=true},markerFactory:()=>({sync:()=>false}),write:x=>logs.push(x),setIntervalFn:()=>({}),clearIntervalFn:()=>{},adapterFactory:()=>({status:'disabled'})}),/health_marker_io_failed/);
 assert.equal(spawned,false);assert.deepEqual(logs,[{event:'shadow_monitor_alert',code:'health_marker_io_failed',execution:'disabled'}]);
});
test('failed marker removal terminates worker and fails supervisor closed',()=>{
 const child=new EventEmitter();child.stdout=new EventEmitter();let signal;child.kill=value=>{signal=value};const logs=[];let fail=false;
 startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},spawnWorker:()=>child,markerFactory:()=>({sync:()=>{if(fail)throw Error('sensitive path');return true}}),write:x=>logs.push(x),setIntervalFn:()=>({}),clearIntervalFn:()=>{},adapterFactory:()=>({status:'disabled'})});
 child.stdout.emit('data',event({}));child.stdout.emit('data',claimEvent(0));fail=true;
 assert.throws(()=>child.stdout.emit('data',event({dataUnavailable:1})),/health_marker_io_failed/);
 assert.equal(signal,'SIGTERM');assert.equal(logs.at(-1).code,'health_marker_io_failed');assert.equal(JSON.stringify(logs).includes('sensitive path'),false);
});
test('unhandled marker I/O failure exits the supervisor process nonzero',()=>{
 const moduleUrl=new URL('./scheduled-shadow-supervisor.mjs',import.meta.url).href;
 const script=`import {EventEmitter} from 'node:events';import {startSupervisor} from ${JSON.stringify(moduleUrl)};
 const child=new EventEmitter();child.stdout=new EventEmitter();child.kill=()=>process.stdout.write('worker-terminated\\n');let broken=false;
 startSupervisor({env:{NODE_ENV:'production',KITS_SHADOW_SCHEDULER_ENABLED:'true',KITS_SHADOW_HEALTH_FILE:'/run/kits-shadow/healthy'},spawnWorker:()=>child,markerFactory:()=>({sync:()=>!broken}),adapterFactory:()=>({status:'disabled'})});
 broken=true;child.stdout.emit('data',JSON.stringify({event:'scheduled_shadow',status:'unavailable',execution:'disabled'})+'\\n');`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});
 assert.equal(result.status,1);assert.match(result.stdout,/worker-terminated/);assert.match(result.stderr,/health_marker_io_failed/);
});
