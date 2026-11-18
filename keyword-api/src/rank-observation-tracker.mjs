// Pure tracking state for simulated or independently supplied observations.
// No network, scheduler, advertisement mutation, or persistence is installed.
// `instant` is a measured position at a specific time. `average` describes a
// whole reporting window; it is never promoted to an instantaneous position.
const devices=['pc','mobile'];
const intervals=[10,20,30];
const time=x=>Number.isSafeInteger(x)&&x>=0;
const rank=x=>typeof x==='number'&&Number.isFinite(x)&&x>=1&&x<=1000;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const clone=x=>structuredClone(x);
const validDevice=x=>devices.includes(x);

export function createRankObservationTracking({id:trackingId,changeAt,bid,targets,mode='simulation'}={}){
 if(!id(trackingId)||!time(changeAt)||!Number.isSafeInteger(changeAt+30*60000)||!Number.isSafeInteger(bid)||bid<0||!targets||!devices.every(d=>rank(targets[d])&&Number.isInteger(targets[d]))||mode!=='simulation')throw TypeError('invalid_tracking');
 return {id:trackingId,mode,changeAt,bid,targets:{pc:targets.pc,mobile:targets.mobile},checkpoints:intervals.flatMap(minutes=>devices.map(device=>({minutes,device,dueAt:changeAt+minutes*60000,status:'pending',attempts:[]})))};
}

// Supply one recorded sample for the device/checkpoint, or an unavailable
// result. Source data is intentionally strict: a provider estimate must not be
// accepted as a measured rank, and stale/pre-change windows do not count.
export function recordRankObservation(tracking,{minutes,device,requestedAt,receivedAt,result}={}){
 const next=clone(tracking),cp=next?.checkpoints?.find(x=>x.minutes===minutes&&x.device===device);
 if(!cp||!validDevice(device)||!time(requestedAt)||!time(receivedAt)||receivedAt<requestedAt||requestedAt<cp.dueAt)throw TypeError('invalid_observation_attempt');
 if(cp.status==='observed')throw Error('checkpoint_complete');
 let status='unavailable',observation=null,reason='source_unavailable';
 if(result?.status==='available'){
  const source=typeof result.source==='string'&&/^[a-zA-Z0-9_.-]{1,60}$/.test(result.source)?result.source:null;
  if(result.kind==='instant'&&rank(result.rank)&&time(result.observedAt)&&result.observedAt>=cp.dueAt&&result.observedAt<=receivedAt&&source){
   status='observed';reason=null;observation={kind:'instant',rank:result.rank,observedAt:result.observedAt,source};
  } else if(result.kind==='average'&&rank(result.rank)&&time(result.windowStart)&&time(result.windowEnd)&&result.windowStart>=next.changeAt&&result.windowEnd>result.windowStart&&result.windowEnd>=cp.dueAt&&result.windowEnd<=receivedAt&&source){
   status='observed';reason=null;observation={kind:'average',rank:result.rank,windowStart:result.windowStart,windowEnd:result.windowEnd,source};
  } else {reason='invalid_or_stale_observation';}
 }
 const attempt={requestedAt,receivedAt,status,reason,late:receivedAt>cp.dueAt+60000,observation};
 cp.attempts.push(attempt);cp.status=status;cp.observation=observation;cp.lastAttemptAt=receivedAt;
 return next;
}

// The delay is an interval between sampling instants, not a proven price
// propagation delay. Averages never count as a specific-time measurement.
export function summarizeRankObservationTracking(tracking){
 if(!tracking||!Array.isArray(tracking.checkpoints))throw TypeError('invalid_tracking');
 const summary={};
 for(const device of devices){
  let lastMissAt=null,firstTarget=null;
  const items=tracking.checkpoints.filter(x=>x.device===device).sort((a,b)=>a.dueAt-b.dueAt);
  // Delayed retries may be measured after a later checkpoint: order by actual
  // observation time, not the checkpoint label.
  const points=items.filter(cp=>cp.status==='observed'&&cp.observation?.kind==='instant').map(cp=>cp.observation).sort((a,b)=>a.observedAt-b.observedAt);
  for(const o of points){
   if(o.rank>tracking.targets[device])lastMissAt=o.observedAt;
   else if(firstTarget===null){firstTarget={observedAt:o.observedAt,lowerBoundMs:lastMissAt===null?null:lastMissAt-tracking.changeAt,upperBoundMs:o.observedAt-tracking.changeAt,classification:'observed_interval_not_causal'};break;}
  }
  summary[device]={targetRank:tracking.targets[device],firstObservedTarget:firstTarget,checkpoints:items.map(cp=>({minutes:cp.minutes,status:cp.status,observation:cp.observation??null,late:cp.attempts.at(-1)?.late??null}))};
 }
 return summary;
}
