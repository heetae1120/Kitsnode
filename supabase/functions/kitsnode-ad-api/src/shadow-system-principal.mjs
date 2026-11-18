import {evaluateShadowSchedule} from './shadow-weekly-schedule.mjs';

// Inert composition primitive. The returned methods must remain server-side.
// checkClaim is a trusted, authoritative DB lookup which returns null unless
// the claimed hour, ownership, live connection, current consent and rule
// version are valid. It returns {userId,ruleId,ruleVersion,connectionId,
// slotStartMs,schedule}; callers must not replace it with client input.
// isAccountActive is a trusted Auth admin lookup; deleted, disabled, banned,
// missing, and indeterminate users MUST return false. No browser JWT is stored,
// generated, or used for this worker identity.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const keys=['claimId','connectionId','ruleId','ruleVersion','slotStartMs'];
const validContext=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.join(',')&&uuid(x.claimId)&&uuid(x.connectionId)&&uuid(x.ruleId)&&Number.isSafeInteger(x.ruleVersion)&&x.ruleVersion>=0&&Number.isSafeInteger(x.slotStartMs)&&x.slotStartMs>=0&&x.slotStartMs%3600000===0;
const fail=()=>({status:'unavailable',execution:'disabled'});

export function createShadowSystemPrincipal({verifySession,checkClaim,isAccountActive,runShadow,now=Date.now}={}){
 if(![verifySession,checkClaim,isAccountActive,runShadow,now].every(v=>typeof v==='function'))throw TypeError('invalid_dependencies');
 const capabilities=new WeakMap();
 const eligible=async context=>{
  try{
   const time=now();if(!Number.isSafeInteger(time)||time<context.slotStartMs||time>=context.slotStartMs+3600000)return null;
   const current=await checkClaim(context);
   const after=now();if(!Number.isSafeInteger(after)||after<context.slotStartMs||after>=context.slotStartMs+3600000)return null;
   if(!current||!uuid(current.userId)||current.ruleId!==context.ruleId||current.connectionId!==context.connectionId||current.ruleVersion!==context.ruleVersion||current.slotStartMs!==context.slotStartMs||evaluateShadowSchedule(current.schedule,after).status!=='on')return null;
   if(await isAccountActive(current.userId)!==true)return null;
   const finalTime=now();if(!Number.isSafeInteger(finalTime)||finalTime<context.slotStartMs||finalTime>=context.slotStartMs+3600000)return null;
   return current.userId;
  }catch{return null}
 };
 async function verify(token){
  if(typeof token==='string')return verifySession(token);
  if(!token||typeof token!=='object')return null;
  const stored=capabilities.get(token);if(!stored)return null;
  const userId=await eligible(stored.context);
  // A capability remains valid only during this one invocation, even if an
  // asynchronous DB lookup returns after its simulation finished.
  if(capabilities.get(token)!==stored||userId!==stored.userId)return null;
  return {id:userId};
 }
 async function simulateClaim(input){
  if(!validContext(input))return fail();
  const context=Object.freeze({...input});
  const userId=await eligible(context);if(!userId)return fail();
  const token=Object.freeze({});const state={context,userId};capabilities.set(token,state);
  try{
   const result=await runShadow(token,{action:'simulate',connectionId:context.connectionId,ruleId:context.ruleId},context);
   if(result?.ok!==true||!uuid(result.entryId)||result.result?.status!=='shadow_only'||result.result?.execution!=='disabled'||result.result?.scheduleEvaluation?.status!=='on')return fail();
   // Only aggregate a bounded boolean; never expose target identifiers, upstream
  // responses or blocker details to the worker logger or alert channel. Normal
  // paused ads and required bid-mode conversion are not read failures.
  const readFailure=new Set(['rank_estimate_unavailable','snapshot_invalid','snapshot_stale','current_bid_unavailable','bid_mode_unverified']);
  const blockers=result.result.blockers;
  const dataUnavailable=!Array.isArray(blockers)||blockers.some(x=>typeof x!=='string'||readFailure.has(x));
  return {status:'shadow_only',execution:'disabled',entryId:result.entryId,dataUnavailable};
  }catch{return fail()}finally{capabilities.delete(token)}
 }
 return Object.freeze({verifySession:verify,simulateClaim});
}
