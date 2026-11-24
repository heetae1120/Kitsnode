// Read-only, unmounted service. Customer credentials, entity relationships,
// access and consent must be resolved by trusted server-side dependencies.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const account=v=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const fail=reason=>({status:'unavailable',reason});
const one=(r,value)=>r?.ok===true&&Array.isArray(r.items)&&r.items.filter(x=>x?.id===value).length===1;
const bound=(b,user,connection)=>b&&b.userId===user&&b.status==='read_connected'&&account(b.customerId)&&Number.isSafeInteger(b.revision)&&b.revision>=0&&(!('id' in b)||b.id===connection);
const safeReasons=new Set(['invalid_input','invalid_clock','network_error','access_denied','rate_limited','upstream_error','invalid_response']);
const numeric=v=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);
const count=v=>v===null||(Number.isSafeInteger(v)&&v>=0);
const meta=x=>typeof x==='string'&&/^\d{12}$/.test(x)?x:null;
export function createPerformanceService({verifySession,memberAllowed,getBinding,catalog,statsForCustomer,hourly=false}={}) {
 if(![verifySession,memberAllowed,getBinding,catalog,statsForCustomer].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 async function actor(token){try{const u=await verifySession(token);return uuid(u?.id)&&await memberAllowed(u.id)===true?u.id:null}catch{return null}}
 return async(token,input)=>{
  const user=await actor(token);if(!user)return fail('unauthorized');
  const keys=['connectionId','kind','campaignId','groupId','targetId','since','until'];
  if(!exact(input,keys)||!uuid(input.connectionId)||!['product','keyword'].includes(input.kind)||!id(input.campaignId,'cmp')||!id(input.groupId,'grp')||!id(input.targetId,input.kind==='product'?'nad':'nkw')||!date(input.since)||!date(input.until)||input.since>input.until||Date.parse(input.until)-Date.parse(input.since)>30*86400000||(hourly&&input.since!==input.until))return fail('invalid_input');
  try {
   const b=await getBinding(user,input.connectionId);if(!bound(b,user,input.connectionId))return fail('connection_required');
   const keyword=input.kind==='keyword',common={connectionId:input.connectionId};
   if(!one(await catalog(token,{action:keyword?'keywordCampaigns':'campaigns',...common}),input.campaignId))return fail('target_unavailable');
   if(!one(await catalog(token,{action:keyword?'keywordGroups':'groups',...common,campaignId:input.campaignId}),input.groupId))return fail('target_unavailable');
   if(!one(await catalog(token,{action:keyword?'keywords':'products',...common,campaignId:input.campaignId,groupId:input.groupId}),input.targetId))return fail('target_unavailable');
   const reader=statsForCustomer(b.customerId);if(typeof reader?.read!=='function')return fail('unavailable');
   const r=hourly?await reader.read({targetId:input.targetId,day:input.since}):await reader.read({targetId:input.targetId,since:input.since,until:input.until});
   if(await actor(token)!==user)return fail('unauthorized');
   const latest=await getBinding(user,input.connectionId);if(!bound(latest,user,input.connectionId)||latest.customerId!==b.customerId||latest.revision!==b.revision)return fail('connection_changed');
   if(r?.status==='unavailable')return fail(safeReasons.has(r.reason)?r.reason:'unavailable');
   if(hourly){
    if(!r||r.targetId!==input.targetId||r.day!==input.since)return fail('invalid_response');
    if(r.status==='no_data')return {status:'no_data',targetId:input.targetId,day:input.since,source:'naver_stats'};
    if(r.status!=='observed'||!Array.isArray(r.hours)||r.hours.length>24)return fail('invalid_response');
    const seen=new Set(),hours=[];for(const x of r.hours){if(!Number.isInteger(x.hour)||x.hour<0||x.hour>23||seen.has(x.hour)||![x.impressions,x.clicks,x.purchases].every(count)||![x.cost,x.revenue,x.averageCpc].every(numeric))return fail('invalid_response');seen.add(x.hour);hours.push({hour:x.hour,impressions:x.impressions,clicks:x.clicks,cost:x.cost,purchases:x.purchases,revenue:x.revenue,averageCpc:x.averageCpc});}
    return {status:'observed',targetId:input.targetId,day:input.since,source:'naver_stats',hours,sourceTimes:{compTm:meta(r.compTm),cycleBaseTm:meta(r.cycleBaseTm)}};
   }
   if(!r||r.targetId!==input.targetId||r.period?.since!==input.since||r.period?.until!==input.until||typeof r.observedAt!=='string'||!Number.isFinite(Date.parse(r.observedAt)))return fail('invalid_response');
   const base={status:r.status,targetId:input.targetId,period:{since:input.since,until:input.until},observedAt:r.observedAt,sourceTimes:{compTm:meta(r.sourceTimes?.compTm),cycleBaseTm:meta(r.sourceTimes?.cycleBaseTm)},source:'naver_stats'};
   if(r.status==='no_data'&&r.reason==='empty_response')return {...base,reason:'empty_response'};
   const m=r.metrics;if(r.status!=='observed'||!m||![m.impressions,m.clicks].every(count)||![m.cost,m.clickThroughRate,m.averageClickCost].every(numeric)||[m.impressions,m.clicks,m.cost,m.clickThroughRate,m.averageClickCost].every(x=>x===null))return fail('invalid_response');
   return {...base,metrics:{impressions:m.impressions,clicks:m.clicks,cost:m.cost,clickThroughRate:m.clickThroughRate,averageClickCost:m.averageClickCost}};
  } catch {return fail('unavailable')}
 };
}
