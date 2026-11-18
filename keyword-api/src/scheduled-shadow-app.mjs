import {createScheduledShadowRunner} from './scheduled-shadow-runner.mjs';
import {createScheduledShadowStore} from './scheduled-shadow-store.mjs';
import {createShadowScheduledSimulation} from './shadow-scheduled-simulation.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createShoppingBindingStore,createShoppingCatalogService} from './shopping-catalog-service.mjs';
import {createShoppingPreviewService} from './shopping-preview-service.mjs';
import {createShoppingShadowStore} from './shopping-shadow-service.mjs';
import {createNaverAdReader} from './naver-ad-read.mjs';
import {createNaverRankEstimate} from './naver-rank-estimate.mjs';
import {createDualDeviceEstimateService} from './dual-device-estimate-service.mjs';

// Server-side read-only worker composition. Explicitly disabled unless the
// caller supplies enabled:true; no HTTP handler or timer is installed here.
// A future host must keep serviceClient credentials and this app private.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
export function createScheduledAccountVerifier(serviceClient,{now=Date.now}={}){
 if(typeof serviceClient?.auth?.admin?.getUserById!=='function'||typeof now!=='function')throw TypeError('invalid_dependencies');
 return async id=>{
  if(!uuid(id))return false;
  try{
   const {data,error}=await serviceClient.auth.admin.getUserById(id),user=data?.user,time=now();
   if(error||!user||user.id!==id||user.is_anonymous!==false||user.deleted_at!=null||!Number.isSafeInteger(time))return false;
   const confirmation=user.confirmed_at??user.email_confirmed_at??user.phone_confirmed_at;
   if(typeof confirmation!=='string'||!Number.isFinite(Date.parse(confirmation)))return false;
   if(user.banned_until!=null){const bannedUntil=Date.parse(user.banned_until);if(!Number.isFinite(bannedUntil)||bannedUntil>time)return false;}
   return true;
  }catch{return false}
 };
}
export function createScheduledShadowApp({serviceClient,apiKey,secretKey,fetcher=globalThis.fetch,now=Date.now,enabled=false,limit=100}={}){
 if(typeof serviceClient?.rpc!=='function'||typeof serviceClient?.from!=='function'||typeof serviceClient?.auth?.admin?.getUserById!=='function'||typeof fetcher!=='function'||typeof now!=='function')throw TypeError('invalid_dependencies');
 const scheduledStore=createScheduledShadowStore(serviceClient),isAccountActive=createScheduledAccountVerifier(serviceClient,{now});
 const memberAllowed=createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver'}),getBinding=createShoppingBindingStore(serviceClient),listOwned=createSupabaseConnectionStore(serviceClient).listOwned;
 const readerForCustomer=customerId=>createNaverAdReader({apiKey,secretKey,customerId,fetcher});
 // This worker does not accept, store, or validate browser JWTs. Only the
 // unforgeable per-claim system capability can enter its read services.
 const noBrowserSession=async()=>null;
 const buildReadServices=verifySession=>{
  const catalog=createShoppingCatalogService({verifySession,memberAllowed,listOwned,getBinding,readerForCustomer});
  const preview=createShoppingPreviewService({verifySession,memberAllowed,getBinding,readerForCustomer});
  const rankEstimate=createDualDeviceEstimateService({verifySession,memberAllowed,getBinding,catalog,estimateForCustomer:customerId=>createNaverRankEstimate({apiKey,secretKey,customerId,fetcher})});
  // Scheduled DB candidates restrict type to product/keyword. The group-only
  // report comparison cannot run here and deliberately has no report creator.
  const compare=async()=>({status:'unavailable',execution:'disabled'});
  return {memberAllowed,getBinding,catalog,preview,rankEstimate,compare,store:createShoppingShadowStore(serviceClient)};
 };
 const simulation=createShadowScheduledSimulation({verifySession:noBrowserSession,checkClaim:scheduledStore.checkClaim,isAccountActive,appendClaim:scheduledStore.appendClaim,buildReadServices,now});
 const authorize=async context=>{try{const state=await scheduledStore.checkRule(context);return Boolean(state&&await isAccountActive(state.userId));}catch{return false}};
 const runner=createScheduledShadowRunner({loadCandidates:scheduledStore.loadCandidates,authorize,claimSlot:scheduledStore.claimSlot,inspectUnresolved:scheduledStore.inspectUnresolved,simulate:simulation.simulate,finish:scheduledStore.finish,now,limit});
 return Object.freeze({run:()=>enabled===true?runner():Promise.resolve({status:'disabled',execution:'disabled'}),inspectUnresolved:()=>enabled===true?scheduledStore.inspectUnresolved():Promise.resolve(null)});
}
