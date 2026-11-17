import {compareDeviceRankEstimates} from './dual-device-estimate.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const account=v=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v);
const fail=reason=>({status:'unavailable',reason,execution:'disabled'});
const one=(result,value)=>result?.ok===true&&Array.isArray(result.items)&&result.items.filter(x=>x?.id===value).length===1;

/**
 * Read-only, unmounted service. `catalog` is the trusted server catalog which
 * independently enforces owner, consent, customer and parent/target binding.
 * `estimateForCustomer` must create a server-side Naver estimate transport;
 * neither the user nor request chooses the provider customer or credentials.
 */
export function createDualDeviceEstimateService({verifySession,memberAllowed,getBinding,catalog,estimateForCustomer,now=Date.now}={}){
 if(![verifySession,memberAllowed,getBinding,catalog,estimateForCustomer,now].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 async function actor(token){try{const u=await verifySession(token);return uuid(u?.id)&&await memberAllowed(u.id)===true?u.id:null}catch{return null}}
 return async(token,input)=>{
  const userId=await actor(token);if(!userId)return fail('unauthorized');
  if(!input||!uuid(input.connectionId)||!['product','keyword'].includes(input.kind)||!id(input.campaignId,'cmp')||!id(input.groupId,'grp')||!id(input.targetId,input.kind==='product'?'nad':'nkw')||!Number.isSafeInteger(input.pcPosition)||input.pcPosition<1||input.pcPosition>(input.kind==='product'?4:10)||!Number.isSafeInteger(input.mobilePosition)||input.mobilePosition<1||input.mobilePosition>(input.kind==='product'?4:5)||!Number.isSafeInteger(input.maxBid)||input.maxBid<50||input.maxBid>100000||input.maxBid%10!==0)return fail('invalid_input');
  try{
   const binding=await getBinding(userId,input.connectionId);
   if(!binding||binding.userId!==userId||binding.status!=='read_connected'||!account(binding.customerId)||!Number.isSafeInteger(binding.revision)||binding.revision<0)return fail('connection_required');
   const keyword=input.kind==='keyword',common={connectionId:input.connectionId};
   const campaigns=await catalog(token,{action:keyword?'keywordCampaigns':'campaigns',...common});
   if(!one(campaigns,input.campaignId))return fail('target_unavailable');
   const groups=await catalog(token,{action:keyword?'keywordGroups':'groups',...common,campaignId:input.campaignId});
   if(!one(groups,input.groupId))return fail('target_unavailable');
   const targets=await catalog(token,{action:keyword?'keywords':'products',...common,campaignId:input.campaignId,groupId:input.groupId});
   if(!one(targets,input.targetId))return fail('target_unavailable');
   const estimate=estimateForCustomer(binding.customerId);if(typeof estimate!=='function')return fail('estimate_unavailable');
   const [pc,mobile]=await Promise.all([
    estimate({kind:input.kind,targetId:input.targetId,device:'PC',position:input.pcPosition}),
    estimate({kind:input.kind,targetId:input.targetId,device:'MOBILE',position:input.mobilePosition})
   ]);
   if(await actor(token)!==userId)return fail('unauthorized');
   const current=await getBinding(userId,input.connectionId);
   if(!current||current.userId!==userId||current.status!=='read_connected'||current.customerId!==binding.customerId||current.revision!==binding.revision)return fail('connection_changed');
   if(pc?.position!==input.pcPosition||mobile?.position!==input.mobilePosition)return fail('estimate_unverified');
   return compareDeviceRankEstimates({kind:input.kind,targetId:input.targetId,pc,mobile,maxBid:input.maxBid,nowMs:now()});
  }catch{return fail('unavailable')}
 };
}
