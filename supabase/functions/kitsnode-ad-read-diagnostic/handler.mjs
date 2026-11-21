// Read-only temporary diagnostic: fixed Naver account, trusted operator only.
// A successful result proves Naver visibility, not ownership or member binding.
export function createDiagnostic({verifySession,verifyOperator,resolveAccount,readCampaigns,allowRequest,origin='https://heetae1120.github.io'}) {
 if(![verifySession,verifyOperator,resolveAccount,readCampaigns,allowRequest].every(x=>typeof x==='function'))throw new TypeError('invalid_dependencies');
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
  const match=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);
  if(!match)return reply(401,{error:'unauthenticated'});
  let user;try{user=await verifySession(match[1]);if(!user?.id)return reply(401,{error:'unauthenticated'});if(await verifyOperator(user.id)!==true)return reply(403,{error:'forbidden'});if(await allowRequest(user.id)!==true)return reply(429,{error:'rate_limited'});}catch{return reply(503,{error:'unavailable'});}
  try{
   const r=await resolveAccount('2632357');
   if(r?.ok===true && r.adAccountId==='2632357' && /^[1-9][0-9]{0,15}$/.test(r.customerId || '') && ['OWNER','MASTER','READ_ONLY'].includes(r.role)){
    let campaigns;try{campaigns=await readCampaigns(r.customerId);}catch{campaigns=null;}
    if(campaigns?.ok===true && Array.isArray(campaigns.data) && campaigns.data.length<=10000)return reply(200,{status:'accessible',role:r.role,campaigns:{status:'observed',returnedCount:campaigns.data.length}});
    const allowedCampaignErrors=['network_error','access_denied','rate_limited','upstream_error','invalid_response'];
    return reply(200,{status:'accessible',role:r.role,campaigns:{status:'unavailable',reason:allowedCampaignErrors.includes(campaigns?.code)?campaigns.code:'unavailable'}});
   }
   const allowed=['invalid_target','network_error','access_denied','rate_limited','upstream_error','invalid_response','not_accessible','pagination_limit','ambiguous_response'];
   return reply(200,{status:'unavailable',reason:allowed.includes(r?.code)?r.code:'unavailable'});
  }catch{return reply(503,{error:'unavailable'});}
 };
}
