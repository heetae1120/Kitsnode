import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createScheduledShadowApp} from './scheduled-shadow-app.mjs';
import {createScheduledShadowTimer} from './scheduled-shadow-timer.mjs';
import {createClaimPoller} from './scheduled-shadow-claim-poller.mjs';

// Dedicated, opt-in Node process; never imported into a web route. No user JWT
// is read or persisted and no provider mutation adapter is imported. A managed
// external process supervisor must launch and monitor this long-running worker.
const disabled=()=>({status:'disabled',execution:'disabled',stop:()=>false});
const invalid=()=>({status:'configuration_error',execution:'disabled',stop:()=>false});
// Fixed, aggregate-only output. Never log provider responses, identities,
// credentials, exception messages, or arbitrary runner-supplied fields.
const countKeys=['considered','off','unset','invalid','unauthorized','duplicate','inProgress','recorded','skipped','uncertain','recordUnknown','dataUnavailable','unresolved'];
const allowedReasons=new Set(['invalid_clock','load_failed','invalid_candidates','runner_failed','runner_timeout','clock_mismatch','hour_expired','wait_failed','candidate_limit','unresolved_check_failed']);
export function scheduledWorkerLog(result){
 const status=['completed','unavailable','disabled'].includes(result?.status)?result.status:'unavailable';
 const reason=allowedReasons.has(result?.reason)?result.reason:undefined;
 const counts={};if(result?.counts&&typeof result.counts==='object')for(const key of countKeys){const value=result.counts[key];if(Number.isSafeInteger(value)&&value>=0&&value<=1000000)counts[key]=value;}
 return {event:'scheduled_shadow',status,...(reason?{reason}:{}),...(Object.keys(counts).length?{counts}:{}),execution:'disabled'};
}

const config=env=>{
 if(env?.NODE_ENV!=='production'||env?.KITS_SHADOW_SCHEDULER_ENABLED!=='true')return null;
 const url=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY,apiKey=env.NAVER_SEARCHAD_API_KEY,secretKey=env.NAVER_SEARCHAD_SECRET_KEY;
 if(![url,key,apiKey,secretKey].every(x=>typeof x==='string'&&x.length>0&&x.length<=8192))return false;
 try{const u=new URL(url);if(u.protocol!=='https:'||!/^[a-z0-9]{20}\.supabase\.co$/.test(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||u.hash)return false;}catch{return false}
 if(![key,apiKey,secretKey].every(x=>/^[\x21-\x7e]+$/.test(x)))return false;
 return {url,key,apiKey,secretKey};
};
export function bootScheduledShadowWorker({env=process.env,clientFactory=createClient,appFactory=createScheduledShadowApp,timerFactory=createScheduledShadowTimer,pollerFactory=createClaimPoller,signals=process,writeLog=line=>process.stdout.write(line+'\n')}={}){
 const cfg=config(env);if(cfg===null)return disabled();if(cfg===false)return invalid();
 if(![clientFactory,appFactory,timerFactory,pollerFactory].every(f=>typeof f==='function')||typeof signals?.once!=='function'||typeof signals?.removeListener!=='function'||typeof writeLog!=='function')return invalid();
 try{
  const client=clientFactory(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const app=appFactory({serviceClient:client,apiKey:cfg.apiKey,secretKey:cfg.secretKey,enabled:true});
  if(typeof app?.run!=='function'||typeof app?.inspectUnresolved!=='function')return invalid();
  const timer=timerFactory({run:app.run,enabled:true,onResult:result=>{try{writeLog(JSON.stringify(scheduledWorkerLog(result)))}catch{/* logging cannot expose or stop work */}}});
  const poller=pollerFactory({inspect:app.inspectUnresolved,onStart:sequence=>{try{if(Number.isSafeInteger(sequence)&&sequence>0)writeLog(JSON.stringify({event:'scheduled_claim_started',sequence,execution:'disabled'}))}catch{}},onResult:result=>{try{const sequence=Number.isSafeInteger(result?.sequence)&&result.sequence>0?result.sequence:0;const valid=sequence>0&&result?.status==='ok'&&Number.isSafeInteger(result.unresolved)&&result.unresolved>=0&&result.unresolved<=2000000;writeLog(JSON.stringify({event:'scheduled_claim_monitor',status:valid?'ok':'unavailable',sequence,...(valid?{unresolved:result.unresolved}:{}),execution:'disabled'}))}catch{/* fixed safe log only */}}});
  if(typeof timer?.start!=='function'||typeof timer?.stop!=='function')return invalid();
  if(typeof poller?.start!=='function'||typeof poller?.stop!=='function')return invalid();
  let stopped=false;
  const stop=()=>{if(stopped)return false;stopped=true;signals.removeListener('SIGINT',stop);signals.removeListener('SIGTERM',stop);timer.stop();poller.stop();return true};
  try{signals.once('SIGINT',stop);signals.once('SIGTERM',stop);if(poller.start()!==true||timer.start()!==true){stop();return invalid()}}catch{stop();return invalid()}
  return Object.freeze({status:'started',execution:'disabled',stop});
 }catch{return invalid()}
}
// Explicit execution only; importing this file never starts a worker.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=bootScheduledShadowWorker();
 if(result.status==='configuration_error')process.exitCode=1;
}
