// Independent read-only claim health polling. No scheduler tick or mutation is
// triggered by this loop; at most one database request may be in flight.
export function createClaimPoller({inspect,onResult,onStart=()=>{},intervalMs=60000,timeoutMs=30000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(typeof inspect!=='function'||typeof onResult!=='function'||typeof onStart!=='function'||!Number.isSafeInteger(intervalMs)||intervalMs<1000||!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>intervalMs||typeof setTimer!=='function'||typeof clearTimer!=='function')throw TypeError('invalid_dependencies');
 let active=false,generation=0,timer=null,watchdog=null,inFlight=false,sequence=0;
 const emit=value=>{try{onResult(value)}catch{/* monitoring never exposes details */}};
 async function poll(expected){
  if(!active||generation!==expected||inFlight)return;
  inFlight=true;const current=++sequence;let timedOut=false;
  try{onStart(current)}catch{/* no unsafe logging */}
  watchdog=setTimer(()=>{watchdog=null;timedOut=true;if(active&&generation===expected)emit({status:'unavailable',sequence:current})},timeoutMs);
  let value;try{value=await inspect()}catch{value=null}
  if(watchdog!==null){clearTimer(watchdog);watchdog=null;}
  inFlight=false;
  if(!active||generation!==expected)return;
  // The server snapshot may predate the timeout. Wait for a fresh query to
  // restore health, but never overlap it with this still-running request.
  if(!timedOut){const valid=value&&['staleClaimed','uncertain'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0&&value[k]<=1000000);
   emit(valid?{status:'ok',unresolved:value.staleClaimed+value.uncertain,sequence:current}:{status:'unavailable',sequence:current});}
  timer=setTimer(()=>{timer=null;void poll(expected)},intervalMs);timer?.unref?.();
 }
 return Object.freeze({start(){if(active||inFlight)return false;active=true;generation++;void poll(generation);return true},stop(){if(!active)return false;active=false;generation++;if(timer!==null){clearTimer(timer);timer=null;}if(watchdog!==null){clearTimer(watchdog);watchdog=null;}return true}});
}
