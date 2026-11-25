// Candidate only. Mounting requires a trusted active-session verifier, durable
// server-owned consent store, and fixed published disclosure version/digest.
const uuid = s => typeof s==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const account = s => typeof s==='string' && /^[1-9][0-9]{0,15}$/.test(s);
export function createInviteConsentHttp({allowedOrigins,verifySession,memberAllowed,allowRequest,listOwned,service}) {
 if(!Array.isArray(allowedOrigins)||!allowedOrigins.length||!allowedOrigins.every(o=>{try{return new URL(o).origin===o&&o.startsWith('https://')}catch{return false}})||![verifySession,memberAllowed,allowRequest,listOwned,service?.record].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return async req=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  const origin=req.headers.get('origin');if(!allowedOrigins.includes(origin))return reply(403,{error:'origin_not_allowed'});headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS') {const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return reply(403,{error:'preflight_denied'});headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});}
  const url=new URL(req.url);if(url.pathname!=='/api/invite-consents'||url.search||url.hash)return reply(404,{error:'not_found'});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];if(!token)return reply(401,{error:'unauthenticated'});
  let user;try {user=await verifySession(token);if(!uuid(user?.id)||!uuid(user?.sessionId))return reply(401,{error:'unauthenticated'});if(await memberAllowed(user.id)!==true)return reply(403,{error:'forbidden'});if(await allowRequest(user.id)!==true)return reply(429,{error:'rate_limited'});}catch{return reply(503,{error:'unavailable'});}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(400,{error:'invalid_input'});
  let body;try {const declared=req.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>1024))return reply(400,{error:'invalid_input'});const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_input'});let size=0;const chunks=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)return reply(400,{error:'invalid_input'});chunks.push(value);}}finally{try{await reader.cancel()}catch{}reader.releaseLock()}const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return reply(400,{error:'invalid_input'});}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!=='accepted,accountId,policyDigest,version'||!account(body.accountId)||body.accepted!==true)return reply(400,{error:'invalid_input'});
  // A pending connection proves only the same member requested this account,
  // never Naver ownership or an accepted invitation.
  try{const rows=await listOwned(user.id);if(!Array.isArray(rows)||rows.length>100||!rows.every(x=>x?.userId===user.id&&account(x.adAccountId)&&['pending_review','read_connected','disconnected'].includes(x.status)))return reply(503,{error:'unavailable'});const match=rows.filter(x=>x.adAccountId===body.accountId&&['pending_review','read_connected'].includes(x.status));if(match.length!==1)return reply(403,{error:'forbidden'});const result=await service.record(token,body);if(!result?.ok)return reply(result?.code==='unauthenticated'?401:result?.code==='invalid_consent'?400:503,{error:result?.code||'unavailable'});if(!uuid(result.consentId))return reply(503,{error:'unavailable'});return reply(201,{consentId:result.consentId,status:'recorded'});}catch{return reply(503,{error:'unavailable'});}
 };
}
