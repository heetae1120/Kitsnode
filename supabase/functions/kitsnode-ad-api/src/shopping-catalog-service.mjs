const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const validId=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const account=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v))?String(v):null;
const label=v=>typeof v==='string'?v.slice(0,160):'';
const status=v=>typeof v==='string'&&/^[A-Z_]{1,50}$/.test(v)?v:'UNKNOWN';
const unique=(items,k)=>new Set(items.map(x=>x[k])).size===items.length;
const fail=reason=>({ok:false,reason});

// Only server-owned, authenticated bindings may select a Naver customer.
export function createShoppingCatalogService({verifySession,memberAllowed,listOwned,getBinding,readerForCustomer}) {
 if(![verifySession,memberAllowed,listOwned,getBinding,readerForCustomer].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return async(token,input)=>{
  let user;try{user=await verifySession(token);if(!uuid(user?.id)||await memberAllowed(user.id)!==true)return fail('unauthorized')}catch{return fail('unauthorized')}
  try{
   if(input?.action==='connections'){
    const rows=await listOwned(user.id);if(!Array.isArray(rows)||rows.length>100)return fail('unavailable');
    const data=rows.filter(x=>x.userId===user.id&&x.status==='read_connected'&&uuid(x.requestId)&&account(x.adAccountId)).map(x=>({id:x.requestId,accountId:x.adAccountId}));
    if(!unique(data,'id'))return fail('unavailable');return {ok:true,items:data};
   }
   if(!['campaigns','groups','products','keywordCampaigns','keywordGroups','keywords'].includes(input?.action)||!uuid(input.connectionId))return fail('invalid_input');
   if(['groups','products','keywordGroups','keywords'].includes(input.action)&&!validId(input.campaignId,'cmp'))return fail('invalid_input');
   if(['products','keywords'].includes(input.action)&&!validId(input.groupId,'grp'))return fail('invalid_input');
   const binding=await getBinding(user.id,input.connectionId);
   if(!binding||binding.userId!==user.id||binding.status!=='read_connected'||!account(binding.customerId)||!Number.isSafeInteger(binding.revision))return fail('connection_required');
   const reader=readerForCustomer(binding.customerId);let items;
   if(['campaigns','keywordCampaigns'].includes(input.action)){
    const r=await reader.campaigns();if(!r.ok||!Array.isArray(r.data)||r.data.length>10000)return fail('upstream_unavailable');
    const rows=r.data.filter(x=>x.campaignTp===(input.action==='campaigns'?'SHOPPING':'WEB_SITE'));
    if(rows.some(x=>!validId(x.nccCampaignId,'cmp')||account(x.customerId)!==binding.customerId)||!unique(rows,'nccCampaignId'))return fail('invalid_response');
    items=rows.map(x=>({id:x.nccCampaignId,name:label(x.name),status:status(x.status)}));
   }else{
    const r=await reader.adgroups(input.campaignId);if(!r.ok||!Array.isArray(r.data)||r.data.length>10000)return fail('upstream_unavailable');
    const rows=r.data.filter(x=>x.adgroupType=== (['keywordGroups','keywords'].includes(input.action)?'WEB_SITE':'SHOPPING'));
    if(rows.some(x=>!validId(x.nccAdgroupId,'grp')||account(x.customerId)!==binding.customerId||x.nccCampaignId!==input.campaignId)||!unique(rows,'nccAdgroupId'))return fail('invalid_response');
    if(['groups','keywordGroups'].includes(input.action))items=rows.map(x=>({id:x.nccAdgroupId,name:label(x.name),status:status(x.status),bid:Number.isSafeInteger(x.bidAmt)?x.bidAmt:null}));
    else{
     if(!rows.some(x=>x.nccAdgroupId===input.groupId))return fail('not_found');
     const a=await (input.action==='keywords'?reader.keywords(input.groupId):reader.shoppingAds(input.groupId));if(!a.ok||!Array.isArray(a.data)||a.data.length>10000)return fail('upstream_unavailable');
     const products=input.action==='keywords'?a.data:a.data.filter(x=>x.type==='SHOPPING_PRODUCT_AD');
     if(input.action==='keywords'){if(products.some(x=>!validId(x.nccKeywordId,'nkw')||account(x.customerId)!==binding.customerId||x.nccAdgroupId!==input.groupId)||!unique(products,'nccKeywordId'))return fail('invalid_response');items=products.map(x=>({id:x.nccKeywordId,name:label(x.keyword)||'키워드 이름 확인 불가',status:status(x.status),useGroupBid:typeof x.useGroupBidAmt==='boolean'?x.useGroupBidAmt:null,bid:Number.isSafeInteger(x.bidAmt)?x.bidAmt:null}));}else{
     if(products.some(x=>!validId(x.nccAdId,'nad')||account(x.customerId)!==binding.customerId||x.nccAdgroupId!==input.groupId)||!unique(products,'nccAdId'))return fail('invalid_response');
     items=products.map(x=>({id:x.nccAdId,name:label(x.referenceData?.productName||x.referenceData?.productTitle)||'상품명 확인 불가',status:status(x.status),useGroupBid:typeof x.adAttr?.useGroupBidAmt==='boolean'?x.adAttr.useGroupBidAmt:null,bid:Number.isSafeInteger(x.adAttr?.bidAmt)?x.adAttr.bidAmt:null}));}
    }
   }
   const current=await getBinding(user.id,input.connectionId);
   if(!current||current.userId!==user.id||current.status!=='read_connected'||current.customerId!==binding.customerId||current.revision!==binding.revision)return fail('connection_changed');
   return {ok:true,items};
  }catch{return fail('unavailable')}
 };
}

export function createShoppingBindingStore(client){
 if(typeof client?.rpc!=='function')throw TypeError('invalid_client');
 return async(userId,connectionId)=>{
  if(!uuid(userId)||!uuid(connectionId))return null;
  const {data,error}=await client.rpc('kits_ads_get_binding',{p_request_id:connectionId,p_user_id:userId});
  if(error||!Array.isArray(data)||data.length!==1)return null;
  const x=data[0],rev=typeof x.revision==='string'&&/^\d+$/.test(x.revision)?Number(x.revision):x.revision;
  if(x.request_id!==connectionId||x.user_id!==userId||x.status!=='read_connected'||!account(x.customer_id)||!Number.isSafeInteger(rev)||rev<0)return null;
  return {userId,customerId:String(x.customer_id),status:x.status,revision:rev};
 };
}
