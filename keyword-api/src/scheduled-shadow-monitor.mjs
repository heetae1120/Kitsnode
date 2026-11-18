// Only fixed, aggregate diagnostics are emitted: never include error text or IDs.
const failures=['invalid','unauthorized','skipped','uncertain','recordUnknown','dataUnavailable','unresolved'];
export function assessShadowEvent(value){
 if(!value||value.event!=='scheduled_shadow'||value.execution!=='disabled'||!['completed','unavailable','disabled'].includes(value.status))return 'invalid_event';
 if(value.status!=='completed')return 'worker_unavailable';
 if(!value.counts||typeof value.counts!=='object')return 'invalid_event';
 for(const key of failures){const n=value.counts[key];if(!Number.isSafeInteger(n)||n<0)return 'invalid_event';if(n>0)return 'run_incomplete';}
 return 'ok';
}
export function createShadowMonitor({now=Date.now,alert=()=>{},initialTimeoutMs=720000,intervalTimeoutMs=4500000,requireClaimCheck=false,claimTimeoutMs=180000}={}){
 let deadline=now()+initialTimeoutMs,lastFailure=null,hasSuccess=false,claimDeadline=now()+claimTimeoutMs,claimFailure=null,claimSuccess=false,claimStarted=0,claimBarrier=0;
 const report=code=>{if(code!==lastFailure){lastFailure=code;alert({event:'shadow_monitor_alert',code,execution:'disabled'});}};
 const reportClaim=code=>{if(code!==claimFailure){claimFailure=code;alert({event:'shadow_monitor_alert',code,execution:'disabled'});}};
 return {
  result(event){const code=assessShadowEvent(event);deadline=now()+intervalTimeoutMs;if(code==='ok'){lastFailure=null;hasSuccess=true;}else if(requireClaimCheck&&code==='run_incomplete'&&event?.counts?.unresolved>0&&failures.every(k=>k==='unresolved'||event.counts[k]===0)){lastFailure=null;hasSuccess=true;claimBarrier=claimStarted;reportClaim('unresolved_claims');}else report(code);return code;},
  claimStart(event){if(event?.event!=='scheduled_claim_started'||event?.execution!=='disabled'||!Number.isSafeInteger(event.sequence)||event.sequence!==claimStarted+1){reportClaim('claim_check_unavailable');return false}claimStarted=event.sequence;return true;},
  claimResult(event){claimDeadline=now()+claimTimeoutMs;const valid=event?.event==='scheduled_claim_monitor'&&event?.execution==='disabled'&&event?.status==='ok'&&Number.isSafeInteger(event.sequence)&&event.sequence===claimStarted&&Number.isSafeInteger(event.unresolved)&&event.unresolved>=0&&event.unresolved<=2000000;if(!valid){reportClaim('claim_check_unavailable');return 'claim_check_unavailable'}if(event.unresolved>0){claimBarrier=claimStarted;reportClaim('unresolved_claims');return 'unresolved_claims'}if(event.sequence<=claimBarrier)return 'unresolved_claims';claimFailure=null;claimSuccess=true;return 'ok';},
  check(){let ok=true;if(now()>deadline){report('result_overdue');ok=false}if(requireClaimCheck&&now()>claimDeadline){reportClaim('claim_check_overdue');ok=false}return ok;},
  childExit(){report('worker_exit')},
  isHealthy(){return hasSuccess&&lastFailure===null&&now()<=deadline&&(!requireClaimCheck||(claimSuccess&&claimFailure===null&&now()<=claimDeadline));},
 };
}
