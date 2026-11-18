// Explicitly started timer for a durable long-running server. The durable DB
// claim prevents duplicate work across restarts or multiple worker processes.
// A serverless host must use an external scheduler instead of this timer.
// The watchdog cannot cancel a hung promise: it permanently stops this timer
// instance and refuses restart, so a second in-process run cannot overlap it.
export function createScheduledShadowTimer({run,enabled=false,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,setWatchdog=setTimeout,clearWatchdog=clearTimeout,runTimeoutMs=600000,onResult=()=>{}}={}){
 if(![run,now,setTimer,clearTimer,setWatchdog,clearWatchdog,onResult].every(v=>typeof v==='function')||!Number.isSafeInteger(runTimeoutMs)||runTimeoutMs<1000||runTimeoutMs>3600000)throw TypeError('invalid_dependencies');
 let active=false,inFlight=false,timedOut=false,timer=null,watchdog=null,generation=0;
 const report=result=>{try{onResult(result)}catch{/* monitoring must not halt future ticks */}};
 async function tick(runGeneration){
  if(!active||generation!==runGeneration||inFlight||timedOut)return;
  inFlight=true;
  watchdog=setWatchdog(()=>{
   watchdog=null;
   if(!active||generation!==runGeneration||!inFlight)return;
   timedOut=true;active=false;generation++;
   report({status:'unavailable',reason:'runner_timeout',execution:'disabled'});
  },runTimeoutMs);
  let result;try{result=await run()}catch{result={status:'unavailable',reason:'runner_failed',execution:'disabled'}}
  if(watchdog!==null){clearWatchdog(watchdog);watchdog=null;}
  inFlight=false;
  if(!active||generation!==runGeneration||timedOut)return;
  report(result);
  if(!active||generation!==runGeneration)return;
  const time=now();if(!Number.isSafeInteger(time)||time<0){active=false;report({status:'unavailable',reason:'invalid_clock',execution:'disabled'});return;}
  const delay=3600000-(time%3600000);
  timer=setTimer(()=>{timer=null;void tick(runGeneration)},delay);
 }
 return Object.freeze({
  start(){if(enabled!==true||active||inFlight||timedOut)return false;active=true;generation++;void tick(generation);return true},
  stop(){if(!active)return false;active=false;generation++;if(timer!==null){clearTimer(timer);timer=null;}if(watchdog!==null){clearWatchdog(watchdog);watchdog=null;}return true},
  isRunning(){return active}
 });
}
