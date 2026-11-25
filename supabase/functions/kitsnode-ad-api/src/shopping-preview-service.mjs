import {previewShoppingBid,illustrateShoppingGroupBid} from './shopping-bid-preview.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const failure=reason=>({status:'unavailable',reason});
const one=(rows,key,value)=>{if(!Array.isArray(rows))return null;const a=rows.filter(x=>x?.[key]===value);return a.length===1?a[0]:null;};

// Read-only application service. Dependencies must enforce their own server-side
// Auth/consent and owner-scoped binding checks. No bid writer is accepted.
export function createShoppingPreviewService({verifySession,memberAllowed,getBinding,readerForCustomer,now=Date.now}) {
 if(![verifySession,memberAllowed,getBinding,readerForCustomer,now].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return async function preview(token,input){
  if(!input||!uuid(input.connectionId)||!id(input.campaignId,'cmp')||!id(input.adgroupId,'grp')||!['product','adgroup'].includes(input.scope)||(input.scope==='product'&&!id(input.adId,'nad'))||![input.referenceBid,input.minBid,input.maxBid,input.maxChange].every(Number.isSafeInteger))return failure('invalid_input');
  let user;try{user=await verifySession(token);if(!uuid(user?.id)||await memberAllowed(user.id)!==true)return failure('unauthorized');}catch{return failure('unauthorized');}
  try {
   const binding=await getBinding(user.id,input.connectionId);
   if(!binding||binding.userId!==user.id||binding.status!=='read_connected'||typeof binding.customerId!=='string'||!Number.isSafeInteger(binding.revision))return failure('connection_required');
   const start=now(),reader=readerForCustomer(binding.customerId);
   const c=await reader.campaigns();if(!c.ok)return failure('campaign_unavailable');
   const campaign=one(c.data,'nccCampaignId',input.campaignId);if(!campaign)return failure('campaign_unavailable');
   const g=await reader.adgroups(input.campaignId);if(!g.ok)return failure('adgroup_unavailable');
   const group=one(g.data,'nccAdgroupId',input.adgroupId);if(!group)return failure('adgroup_unavailable');
   if(String(campaign.customerId)!==binding.customerId||String(group.customerId)!==binding.customerId||group.nccCampaignId!==campaign.nccCampaignId)return failure('target_mismatch');
   // Do not enumerate products for a paused parent merely to produce a bid.
   if(input.scope==='product'&&(campaign.status!=='ELIGIBLE'||campaign.userLock!==false||group.status!=='ELIGIBLE'||group.userLock!==false))return {status:'skipped',reason:'parent_inactive'};
   if(input.scope==='product'&&group.autobidStrategy?.isAutobidActive!==false)return {status:'skipped',reason:group.autobidStrategy?.isAutobidActive===true?'naver_autobid_active':'naver_autobid_unverified'};
   const a=await reader.shoppingAds(input.adgroupId);if(!a.ok||!Array.isArray(a.data))return failure('products_unavailable');
   const current=await getBinding(user.id,input.connectionId);
   if(!current||current.userId!==user.id||current.status!=='read_connected'||current.customerId!==binding.customerId||current.revision!==binding.revision)return failure('connection_changed');
   const common={connection:binding,actorId:user.id,campaign,group,referenceBid:input.referenceBid,minBid:input.minBid,maxBid:input.maxBid,maxChange:input.maxChange,nowMs:now(),fetchedAtMs:start};
   if(input.scope==='adgroup')return illustrateShoppingGroupBid({...common,products:a.data,productsComplete:a.complete===true});
   const ad=one(a.data,'nccAdId',input.adId);if(!ad)return failure('product_unavailable');
   return previewShoppingBid({...common,ad});
  }catch{return failure('unavailable');}
 };
}
