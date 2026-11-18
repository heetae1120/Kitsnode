// Independent wrapper around the read-only simulation worker. No bid mutation.
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createShadowMonitor} from './scheduled-shadow-monitor.mjs';
import {createCloudInsightAdapter} from './cloud-insight-adapter.mjs';
import {createHealthMarker} from './scheduled-shadow-health-marker.mjs';
// Deadline tracking uses a monotonic clock: NTP wall-clock adjustments must not
// delay or prematurely fire independent health alarms.
export function startSupervisor({env=process.env,spawnWorker=spawn,write=event=>process.stdout.write(JSON.stringify(event)+'\n'),now=()=>performance.now(),adapterFactory=createCloudInsightAdapter,markerFactory=createHealthMarker,setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}){
 if(env.NODE_ENV!=='production'||env.KITS_SHADOW_SCHEDULER_ENABLED!=='true')return {status:'disabled'};
 // An enabled supervisor must always be connected to the independently
 // monitored fixed marker; missing/incorrect configuration is not healthy.
 if(env.KITS_SHADOW_HEALTH_FILE!=='/run/kits-shadow/healthy')throw Error('invalid_health_marker_configuration');
 const safeWrite=event=>{try{write(event)}catch{}};
 const monitor=createShadowMonitor({now,alert:safeWrite,requireClaimCheck:true});
 // Fixed path prevents configuration from writing elsewhere on the host.
 const marker=markerFactory({path:env.KITS_SHADOW_HEALTH_FILE});
 // A stale healthy marker would suppress the external file-based alarm. Fail
 // the supervisor (and terminate its worker) so systemd/process monitoring
 // can alert independently instead of reporting a false healthy state.
 let child;
 const updateMarker=healthy=>{let ok=false;try{ok=marker.sync(healthy)===true}catch{/* fixed message only */}if(!ok){safeWrite({event:'shadow_monitor_alert',code:'health_marker_io_failed',execution:'disabled'});try{child?.kill('SIGTERM')}catch{}throw Error('health_marker_io_failed');}};
 updateMarker(false);
 const adapter=adapterFactory({env});let deliveryFailure=false;
 const sendMetric=async()=>{
  if(adapter.status==='disabled')return;
  let result;try{result=await adapter.publish({healthy:monitor.isHealthy()});}catch{result={status:'unavailable'}}
  if(result?.status==='sent'){deliveryFailure=false;return;}
  if(result?.status==='busy')return;
  if(!deliveryFailure){deliveryFailure=true;safeWrite({event:'shadow_monitor_alert',code:'metrics_delivery_failed',execution:'disabled'});}
 };
 const workerEnv={...env};delete workerEnv.NCP_CLOUD_INSIGHT_ACCESS_KEY;delete workerEnv.NCP_CLOUD_INSIGHT_SECRET_KEY;delete workerEnv.NCP_CLOUD_INSIGHT_CW_KEY;
 child=spawnWorker(process.execPath,[fileURLToPath(new URL('./scheduled-shadow-worker.mjs',import.meta.url))],{env:workerEnv,stdio:['ignore','pipe','ignore']});
 let buffer='',stopping=false;
 child.stdout.on('data',data=>{
  buffer+=data.toString('utf8');
  if(buffer.length>65536){buffer='';monitor.result(null);updateMarker(false);return;}
  let index;while((index=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);let value;try{value=JSON.parse(line)}catch{value=null}if(value?.event==='scheduled_claim_started')monitor.claimStart(value);else if(value?.event==='scheduled_claim_monitor')monitor.claimResult(value);else if(monitor.result(value)==='ok')safeWrite({event:'shadow_monitor_success',execution:'disabled'});updateMarker(monitor.isHealthy());}
 });
 child.on('error',()=>{monitor.childExit();updateMarker(false);process.exitCode=1;});
 child.on('exit',()=>{if(!stopping){monitor.childExit();updateMarker(false);process.exitCode=1;}clearIntervalFn(timer);clearIntervalFn(metricsTimer)});
 const timer=setIntervalFn(()=>{monitor.check();updateMarker(monitor.isHealthy())},30000);timer?.unref?.();
 const metricsTimer=setIntervalFn(()=>{void sendMetric()},60000);metricsTimer?.unref?.();
 void sendMetric();
 return {status:'started',stop(){stopping=true;updateMarker(false);clearIntervalFn(timer);clearIntervalFn(metricsTimer);child.kill('SIGTERM');}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const supervisor=startSupervisor();
 if(supervisor.status==='disabled'){process.stdout.write('{"event":"shadow_monitor_disabled","execution":"disabled"}\n');process.exitCode=1;}
 else {
  // systemd detects a stalled supervisor independently; never restart automatically.
  const notify=(arg)=>{if(process.env.NOTIFY_SOCKET)spawnSync('/usr/bin/systemd-notify',[arg],{env:{NOTIFY_SOCKET:process.env.NOTIFY_SOCKET},stdio:'ignore',timeout:2000});};
  notify('--ready');const heartbeat=setInterval(()=>notify('WATCHDOG=1'),30000);heartbeat.unref();
  for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{clearInterval(heartbeat);supervisor.stop();});
 }
}
