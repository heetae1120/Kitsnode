import {createShoppingMasterClient,parseShoppingMaster} from './shopping-master-report.mjs';
import {compareShoppingSources} from './shopping-shadow-run.mjs';

const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const fail=reason=>({status:'unavailable',reason,execution:'disabled'});

// Server-only orchestration; no route, scheduler, storage or bid writer is
// installed by importing this. The caller must provide authenticated bindings.
export function createShoppingMasterComparison({verifySession,memberAllowed,getBinding,reserveReport,readerForCustomer,masterForCustomer,now=Date.now,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(![verifySession,memberAllowed,getBinding,reserveReport,readerForCustomer,masterForCustomer,now,wait].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return async(token,input)=>{
  if(!input||!uuid(input.connectionId)||!id(input.campaignId,'cmp')||!id(input.adgroupId,'grp'))return fail('invalid_input');
  let user;try{user=await verifySession(token);if(!uuid(user?.id)||await memberAllowed(user.id)!==true)return fail('unauthorized')}catch{return fail('unauthorized')}
  try{
   const binding=await getBinding(user.id,input.connectionId);
   if(!binding||binding.userId!==user.id||binding.status!=='read_connected'||typeof binding.customerId!=='string'||!Number.isSafeInteger(binding.revision))return fail('connection_required');
   const reader=readerForCustomer(binding.customerId),campaigns=await reader.campaigns();if(!campaigns.ok||!Array.isArray(campaigns.data))return fail('campaign_unavailable');
   const matches=campaigns.data.filter(x=>x.nccCampaignId===input.campaignId&&x.campaignTp==='SHOPPING'&&String(x.customerId)===binding.customerId);if(matches.length!==1)return fail('target_mismatch');
   const groups=await reader.adgroups(input.campaignId);if(!groups.ok||!Array.isArray(groups.data))return fail('group_unavailable');
   const target=groups.data.filter(x=>x.nccAdgroupId===input.adgroupId&&x.nccCampaignId===input.campaignId&&x.adgroupType==='SHOPPING'&&String(x.customerId)===binding.customerId);if(target.length!==1)return fail('target_mismatch');
   if(await reserveReport(user.id,input.connectionId,binding.revision)!==true)return fail('report_cooldown');
   const master=masterForCustomer(binding.customerId);const created=await master.create();if(!created.ok)return fail('report_creation_unconfirmed');
   let job;for(let i=0;i<20;i++){const response=await master.get(created.id);if(!response.ok)return fail('report_unavailable');job=response.job;if(job.status==='BUILT')break;if(job.status==='NONE'||job.status==='ERROR')return fail(job.status==='NONE'?'report_empty_or_unavailable':'report_failed');await wait(2000)}
   if(job?.status!=='BUILT')return fail('report_not_ready');
   const reportAt=Date.parse(job.updateTime);if(!Number.isFinite(reportAt))return fail('report_time_unavailable');
   const report=await master.download(job);if(!report.ok)return fail('report_download_unavailable');
   const parsed=parseShoppingMaster(report.data,{customerId:binding.customerId,adgroupId:input.adgroupId});if(!parsed.ok)return fail('invalid_report');
   const live=await reader.shoppingAds(input.adgroupId);if(!live.ok||!Array.isArray(live.data))return fail('products_unavailable');
   const liveAt=now(),rows=live.data.map(x=>({id:x.nccAdId,adgroupId:x.nccAdgroupId,customerId:String(x.customerId),useGroupBid:x.adAttr?.useGroupBidAmt}));
   const comparison=compareShoppingSources({customerId:binding.customerId,adgroupId:input.adgroupId,live:rows,master:parsed.rows,liveAt,masterAt:reportAt,now:liveAt});
   const current=await getBinding(user.id,input.connectionId),session=await verifySession(token);if(!current||current.userId!==user.id||current.status!=='read_connected'||current.customerId!==binding.customerId||current.revision!==binding.revision||session?.id!==user.id||await memberAllowed(user.id)!==true)return fail('connection_changed');
   if(comparison.status==='unavailable')return fail(comparison.reason);
   return {...comparison,reportAt:new Date(reportAt).toISOString(),liveAt:new Date(liveAt).toISOString(),deletedMasterRows:parsed.deleted};
  }catch{return fail('unavailable')}
 };
}

export {createShoppingMasterClient};
