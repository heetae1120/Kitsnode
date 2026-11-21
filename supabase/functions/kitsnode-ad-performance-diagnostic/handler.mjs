// One-account, read-only operator diagnostic; not a customer analysis route.
export function createPerformanceDiagnostic({verifySession,verifyOperator,allowRequest,resolveAccount,readCampaigns,readStats,now=Date.now,origin='https://heetae1120.github.io'}) {
 if(![verifySession,verifyOperator,allowRequest,resolveAccount,readCampaigns,readStats,now].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return async req=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(req.headers.get('origin')!==origin)return reply(403,{error:'forbidden'});
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return reply(403,{error:'forbidden'});
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];
  if(!token)return reply(401,{error:'unauthenticated'});
  try{
   const user=await verifySession(token);if(!user?.id)return reply(401,{error:'unauthenticated'});
   if(await verifyOperator(user.id)!==true)return reply(403,{error:'forbidden'});
   if(await allowRequest(user.id)!==true)return reply(429,{error:'rate_limited'});
   const account=await resolveAccount('2647636');
   if(!account?.ok||account.adAccountId!=='2647636'||!/^[1-9][0-9]{0,15}$/.test(account.customerId||'')||!['OWNER','MASTER','READ_ONLY'].includes(account.role))return reply(200,{status:'unavailable',stage:'account'});
   const campaigns=await readCampaigns(account.customerId);
   if(!campaigns?.ok||!Array.isArray(campaigns.data)||campaigns.data.length>10000)return reply(200,{status:'unavailable',stage:'campaigns'});
   const ids=[...new Set(campaigns.data.map(x=>x?.nccCampaignId).filter(x=>typeof x==='string'&&/^cmp-[A-Za-z0-9-]{1,100}$/.test(x)))].sort().slice(0,5);
   if(!ids.length)return reply(200,{status:'no_campaigns'});
   // KST calendar period ending yesterday. The server, never the caller,
   // chooses the account, entity and bounded period.
   const today=Math.floor((now()+9*3600000)/86400000),day=n=>new Date(n*86400000).toISOString().slice(0,10);
   const until=day(today-1),since=day(today-7);
   let checked=0,empty=0,errors=0,firstError='unavailable';
   for(const targetId of ids){
    let result;try{result=await readStats(account.customerId,{targetId,since,until});}catch{result={status:'unavailable',reason:'unavailable'}}
    checked++;
    const current=await verifySession(token);
    if(current?.id!==user.id||await verifyOperator(user.id)!==true)return reply(403,{error:'forbidden'});
    if(result?.status==='no_data'){empty++;continue;}
    if(result?.status==='observed'){
     const m=result.metrics;
     if(m&&[m.impressions,m.clicks].every(v=>v===null||Number.isSafeInteger(v)&&v>=0)&&[m.cost,m.clickThroughRate,m.averageClickCost].every(v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0)&&Object.values({a:m.impressions,b:m.clicks,c:m.cost,d:m.clickThroughRate,e:m.averageClickCost}).some(v=>v!==null))return reply(200,{status:'observed',period:{since,until},checked,empty,errors,metrics:{impressions:m.impressions,clicks:m.clicks,cost:m.cost,clickThroughRate:m.clickThroughRate,averageClickCost:m.averageClickCost}});
     result={status:'unavailable',reason:'invalid_response'};
    }
    errors++;
    const reason=['invalid_input','invalid_clock','network_error','access_denied','rate_limited','upstream_error','invalid_response'].includes(result?.reason)?result.reason:'unavailable';
    if(errors===1)firstError=reason;
    // Do not issue additional requests after provider denial, throttling or a transport failure.
    if(['access_denied','rate_limited','network_error'].includes(reason))break;
   }
   if(errors)return reply(200,{status:empty?'partial':'unavailable',stage:'stats',reason:firstError,checked,empty,errors});
   return reply(200,{status:'no_data',period:{since,until},checked,empty});
  }catch{return reply(503,{error:'unavailable'});}
 };
}
