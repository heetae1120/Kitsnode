import {createShadowSystemPrincipal} from './shadow-system-principal.mjs';
import {createShoppingShadowService} from './shopping-shadow-service.mjs';

/**
 * Inert composition for a trusted scheduler worker. Nothing calls this on a
 * timer and no HTTP handler, JWT cache or Naver write is installed here.
 *
 * buildReadServices(verifySession) MUST construct the existing catalog,
 * preview and rank-estimate read services using this exact verifier, the
 * normal memberAllowed and binding checks, and read-only Naver transports.
 * appendClaim MUST be a server-only transactional DB function that validates
 * the live claimed slot, member consent, binding and rule version while it
 * persists the result; a normal append or process-local check is not enough.
 */
export function createShadowScheduledSimulation({verifySession,checkClaim,isAccountActive,appendClaim,buildReadServices,now=Date.now}={}){
 if(![verifySession,checkClaim,isAccountActive,appendClaim,buildReadServices,now].every(v=>typeof v==='function'))throw TypeError('invalid_dependencies');
 let principal;
 principal=createShadowSystemPrincipal({verifySession,checkClaim,isAccountActive,now,runShadow:async(token,input,context)=>{
  const deps=buildReadServices(principal.verifySession);
  if(!deps||typeof deps!=='object'||!deps.store||typeof deps.store!=='object')throw Error('invalid_dependencies');
  const store={...deps.store,append:async(user,ruleId,version,revision,result)=>{
   // The original service independently checks membership, owner and binding.
   // The DB function must recheck these atomically, not trust this process.
   if(ruleId!==context.ruleId||version!==context.ruleVersion||!Number.isSafeInteger(revision)||!result||result.status!=='shadow_only'||result.execution!=='disabled'||result.scheduleEvaluation?.status!=='on')return null;
   return appendClaim({...context,userId:user,connectionRevision:revision,result:{...result,trigger:'scheduled'}});
  }};
  const shadow=createShoppingShadowService({...deps,store,verifySession:principal.verifySession});
  return shadow(token,input);
 }});
 return Object.freeze({simulate:principal.simulateClaim});
}
