import {evaluateShadowSchedule} from './shadow-weekly-schedule.mjs';

// INERT orchestration: no timers, cron, network clients or provider write path.
// It MUST NOT be wired to a browser JWT. The future system worker needs its own
// principal and an explicit policy for user consent, ownership and revocation.
//
// loadCandidates({slotStartMs,limit,afterId}) returns a keyset page
// {status:'ok',items:[{id,version,connectionId,schedule}],nextCursor}, where
// ids are strictly ascending and nextCursor is the final id or null. A database
// hour mismatch returns {status:'clock_mismatch'}, never an empty success.
// No item contains credentials. A legacy non-full array is also accepted.
// authorize({ruleId,ruleVersion,connectionId,slotStartMs}) must check the
// current owner, consent and connection using authoritative server state.
// claimSlot(context) MUST atomically recheck eligibility, schedule and rule
// version and deduplicate the UTC hour using a durable unique constraint. It
// returns {claimId,ruleId,ruleVersion,connectionId,slotStartMs} or null. A
// process-local lock or calling this without that guarantee is unsafe.
// simulate(context) MUST recheck authorization, rule version and schedule
// before work, use provider READS ONLY and append through a compare-and-swap.
// It returns {status:'shadow_only',execution:'disabled',entryId:<uuid>}; it
// may finish after the hour ends but must not start after the hour has ended.
// finish(context) persists the outcome of a claimed hour, returns exactly true,
// and must be idempotent. Failure/unknown outcomes must not release the unique
// claim or trigger an automatic retry (the simulation might have been saved).
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const validTime=v=>Number.isSafeInteger(v)&&v>=0&&Number.isFinite(new Date(v).getTime());
const validRule=r=>r&&uuid(r.id)&&uuid(r.connectionId)&&Number.isSafeInteger(r.version)&&r.version>=0;

export function createScheduledShadowRunner({loadCandidates,authorize,claimSlot,inspectUnresolved,simulate,finish,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),limit=100}={}){
 if(![loadCandidates,authorize,claimSlot,simulate,finish,now,wait].every(f=>typeof f==='function')||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw TypeError('invalid_dependencies');
 if(inspectUnresolved!==undefined&&typeof inspectUnresolved!=='function')throw TypeError('invalid_dependencies');
 return async function runScheduledShadows(){
  const startedAt=now();if(!validTime(startedAt))return {status:'unavailable',reason:'invalid_clock',execution:'disabled'};
  const slotStartMs=Math.floor(startedAt/3600000)*3600000;
  // DB clock can lag the worker at the hour boundary. Retry only an explicit
  // mismatch: an empty candidate array is a valid result. Never retry claims or
  // simulations. Fixed waits bound this read-only correction to 14 seconds.
  const retryDelays=[2000,4000,8000];
  const fail=reason=>({status:'unavailable',reason,execution:'disabled',slotStartMs});
  const sameHour=()=>{const t=now();return validTime(t)&&Math.floor(t/3600000)*3600000===slotStartMs};
  const loadPage=async afterId=>{
   for(let attempt=0;;attempt++){
    if(!sameHour())return {error:'hour_expired'};
    let page;try{page=await loadCandidates({slotStartMs,limit,afterId})}catch{return {error:'load_failed'}}
    if(!sameHour())return {error:'hour_expired'};
    if(!page||Array.isArray(page)||page.status!=='clock_mismatch')return {page};
    if(attempt>=retryDelays.length)return {error:'clock_mismatch'};
    try{await wait(retryDelays[attempt])}catch{return {error:'wait_failed'}}
   }
  };
  // Collect and validate all pages before claiming any slot. This avoids
  // partial runs when a later cursor, page or candidate limit is invalid.
  const rules=[];let afterId=null;
  for(let pageNumber=0;;pageNumber++){
   if(pageNumber>=100)return fail('candidate_limit');
   const loaded=await loadPage(afterId);if(loaded.error)return fail(loaded.error);
   const page=loaded.page;
   if(Array.isArray(page)){
    // Older test adapters expose no cursor; a full page might be truncated.
    if(afterId!==null||page.length>=limit)return fail('invalid_candidates');
    rules.push(...page);break;
   }
   if(!page||page.status!=='ok'||!Array.isArray(page.items)||page.items.length>limit||!(page.nextCursor===null||uuid(page.nextCursor)))return fail('invalid_candidates');
   let previous=afterId;
   for(const item of page.items){
    if(!validRule(item)||(previous!==null&&item.id.toLowerCase()<=previous.toLowerCase()))return fail('invalid_candidates');
    previous=item.id;
   }
   if(page.nextCursor!==null&&(page.items.length!==limit||previous===null||page.nextCursor.toLowerCase()!==previous.toLowerCase()))return fail('invalid_candidates');
   if(rules.length+page.items.length>10000)return fail('candidate_limit');
   rules.push(...page.items);
   if(page.nextCursor===null)break;
   if(rules.length>=10000)return fail('candidate_limit');
   afterId=page.nextCursor;
  }
  const counts={considered:0,off:0,unset:0,invalid:0,unauthorized:0,duplicate:0,inProgress:0,recorded:0,dataUnavailable:0,skipped:0,uncertain:0,recordUnknown:0,unresolved:0};
  if(inspectUnresolved){
   let outstanding;try{outstanding=await inspectUnresolved()}catch{return fail('unresolved_check_failed')}
   if(!outstanding||!['staleClaimed','uncertain'].every(k=>Number.isSafeInteger(outstanding[k])&&outstanding[k]>=0&&outstanding[k]<=1000000))return fail('unresolved_check_failed');
   counts.unresolved=outstanding.staleClaimed+outstanding.uncertain;
  }
  const seen=new Set();
  for(const rule of rules){
   counts.considered++;
   if(!validRule(rule)){counts.invalid++;continue}
   if(seen.has(rule.id)){counts.duplicate++;continue}seen.add(rule.id);
   const current=now();if(!validTime(current)||Math.floor(current/3600000)*3600000!==slotStartMs){counts.skipped++;continue}
   const evaluation=evaluateShadowSchedule(rule.schedule,current);
   if(evaluation.status!=='on'){counts[evaluation.status]++;continue}
   const context=Object.freeze({ruleId:rule.id,ruleVersion:rule.version,connectionId:rule.connectionId,slotStartMs});
   let permitted;try{permitted=await authorize(context)}catch{permitted=false}
   if(permitted!==true){counts.unauthorized++;continue}
   let claim;try{claim=await claimSlot(context)}catch{counts.uncertain++;continue}
   if(claim?.status==='already_recorded'){counts.duplicate++;continue}
   if(claim?.status==='already_skipped'){counts.duplicate++;continue}
   if(claim?.status==='already_resolved'){counts.duplicate++;continue}
   if(claim?.status==='in_progress'){counts.inProgress++;continue}
   if(claim?.status==='unresolved'){counts.unresolved++;continue}
   if(claim?.status==='rejected'){counts.unauthorized++;continue}
   if(claim?.status==='claimed')claim=claim.claim;
   else if(claim&&Object.hasOwn(claim,'status')){counts.uncertain++;continue}
   if(!claim||!uuid(claim.claimId)||Object.keys(context).some(k=>claim[k]!==context[k])){counts.uncertain++;continue}
   const claimed=Object.freeze({...context,claimId:claim.claimId});
   let outcome,dataUnavailable=false;
   try{
    const afterClaim=now();
    if(!validTime(afterClaim)||Math.floor(afterClaim/3600000)*3600000!==slotStartMs)outcome={state:'skipped',reason:'hour_expired'};
    else if(await authorize(context)!==true)outcome={state:'skipped',reason:'authorization_changed'};
    else{
     // Authorization may itself take time; check again immediately before start.
     const beforeSimulation=now();
     if(!validTime(beforeSimulation)||Math.floor(beforeSimulation/3600000)*3600000!==slotStartMs)outcome={state:'skipped',reason:'hour_expired'};
     else{
      const result=await simulate(claimed);
      outcome=result?.status==='shadow_only'&&result?.execution==='disabled'&&uuid(result.entryId)?{state:'recorded',entryId:result.entryId}:{state:'uncertain',reason:'invalid_simulation_result'};
      if(outcome.state==='recorded'&&result.dataUnavailable===true)dataUnavailable=true;
     }
    }
   }catch{outcome={state:'uncertain',reason:'simulation_or_authorization_failed'}}
   if(dataUnavailable)counts.dataUnavailable++;
   let persisted=false;try{persisted=await finish({...claimed,...outcome})===true}catch{/* do not release or retry */}
   if(!persisted)counts.recordUnknown++;
   else counts[outcome.state]++;
  }
  return {status:'completed',execution:'disabled',slotStartMs,counts};
 };
}
