// Read-only, unmounted statistics service. The server-owned catalog checks the
// campaign type and verifies the target is a child of the selected ad group.
// No user-supplied customer id or credentials are accepted.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const account=v=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const exactly=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const fail=reason=>({status:'unavailable',reason,execution:'disabled'});
const one=(r,value)=>r?.ok===true&&Array.isArray(r.items)&&r.items.filter(x=>x?.id===value).length===1;
const same=(b,user,connection)=>b&&b.userId===user&&b.status==='read_connected'&&account(b.customerId)&&Number.isSafeInteger(b.revision)&&b.revision>=0&&(!('id' in b)||b.id===connection);
const safeReason=new Set(['invalid_input','invalid_clock','network_error','access_denied','rate_limited','upstream_error','invalid_response']);
const missingReason=new Set(['empty_response','no_impressions','rank_unavailable']);
const finiteRank=n=>n===null||(typeof n==='number'&&Number.isFinite(n)&&n>=1&&n<=1000);
const meta=x=>typeof x==='string'&&/^\d{12}$/.test(x)?x:null;

export function createRankStatsService({verifySession,memberAllowed,getBinding,catalog,statsForCustomer}={}){
 if(![verifySession,memberAllowed,getBinding,catalog,statsForCustomer].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 async function actor(token){try{const u=await verifySession(token);return uuid(u?.id)&&await memberAllowed(u.id)===true?u.id:null}catch{return null}}
 return async(token,input)=>{
  const user=await actor(token);if(!user)return fail('unauthorized');
  const keys=['connectionId','kind','campaignId','groupId','targetId','since','until'];
  if(!exactly(input,keys)||!uuid(input.connectionId)||!['product','keyword'].includes(input.kind)||!id(input.campaignId,'cmp')||!id(input.groupId,'grp')||!id(input.targetId,input.kind==='product'?'nad':'nkw')||!date(input.since)||!date(input.until)||input.since>input.until||Date.parse(input.until)-Date.parse(input.since)>30*86400000)return fail('invalid_input');
  try{
   const binding=await getBinding(user,input.connectionId);if(!same(binding,user,input.connectionId))return fail('connection_required');
   const keyword=input.kind==='keyword',common={connectionId:input.connectionId};
   if(!one(await catalog(token,{action:keyword?'keywordCampaigns':'campaigns',...common}),input.campaignId))return fail('target_unavailable');
   if(!one(await catalog(token,{action:keyword?'keywordGroups':'groups',...common,campaignId:input.campaignId}),input.groupId))return fail('target_unavailable');
   if(!one(await catalog(token,{action:keyword?'keywords':'products',...common,campaignId:input.campaignId,groupId:input.groupId}),input.targetId))return fail('target_unavailable');
   const reader=statsForCustomer(binding.customerId);if(typeof reader?.read!=='function')return fail('unavailable');
   const result=await reader.read({targetId:input.targetId,since:input.since,until:input.until});
   if(await actor(token)!==user)return fail('unauthorized');
   const current=await getBinding(user,input.connectionId);if(!same(current,user,input.connectionId)||current.customerId!==binding.customerId||current.revision!==binding.revision)return fail('connection_changed');
   if(result?.status==='unavailable')return fail(safeReason.has(result.reason)?result.reason:'unavailable');
   if(!result||result.targetId!==input.targetId||result.period?.since!==input.since||result.period?.until!==input.until||typeof result.observedAt!=='string'||!Number.isFinite(Date.parse(result.observedAt)))return fail('invalid_response');
   const base={status:result.status,execution:'disabled',targetId:input.targetId,period:{since:input.since,until:input.until},observedAt:result.observedAt,sourceTimes:{compTm:meta(result.sourceTimes?.compTm),cycleBaseTm:meta(result.sourceTimes?.cycleBaseTm)},deviceMetricScope:'integrated_search_average',source:'naver_stats',latency:'provider_data_may_be_delayed'};
   if(result.status==='no_data'&&missingReason.has(result.reason))return {...base,reason:result.reason};
   const ranks=[result.overallAverageRank,result.pcIntegratedSearchAverageRank,result.mobileIntegratedSearchAverageRank];
   if(result.status!=='observed'||!Number.isSafeInteger(result.impressions)||result.impressions<1||!ranks.every(finiteRank)||ranks.every(x=>x===null))return fail('invalid_response');
   return {...base,impressions:result.impressions,overallAverageRank:result.overallAverageRank,pcIntegratedSearchAverageRank:result.pcIntegratedSearchAverageRank,mobileIntegratedSearchAverageRank:result.mobileIntegratedSearchAverageRank};
  }catch{return fail('unavailable')}
 };
}
