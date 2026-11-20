// Candidate only: never trust the caller to provide a target user ID.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function createMemberDeleteHandler({enabled,allowedOrigins,verifySession,allowRequest,deleteMember}) {
 if(typeof enabled!=='boolean'||!Array.isArray(allowedOrigins)||!allowedOrigins.length||![verifySession,allowRequest,deleteMember].every(fn=>typeof fn==='function'))throw Error('Invalid dependencies');
 return async req=>{
  const origin=req.headers.get('origin');
  const headers={'cache-control':'no-store','content-type':'application/json','vary':'Origin','x-content-type-options':'nosniff'};
  const out=(body,status)=>new Response(JSON.stringify(body),{status,headers});
  if(!origin||!allowedOrigins.includes(origin))return out({error:'origin_not_allowed'},403);
  headers['access-control-allow-origin']=origin;
  if(req.method==='OPTIONS') {
   const requested=(req.headers.get('access-control-request-headers')||'').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
   if(!['GET','POST'].includes(req.headers.get('access-control-request-method'))||requested.some(v=>!['authorization','apikey','content-type','x-client-info'].includes(v)))return out({error:'preflight_denied'},403);
   headers['access-control-allow-methods']='GET, POST, OPTIONS';headers['access-control-allow-headers']='authorization, apikey, content-type, x-client-info';return new Response(null,{status:204,headers});
  }
  const url=new URL(req.url);if(url.search||!['/functions/v1/kitsnode-member-delete','/kitsnode-member-delete'].includes(url.pathname))return out({error:'not_found'},404);
  if(req.method==='GET')return out({available:enabled},200);
  if(req.method!=='POST')return out({error:'method_not_allowed'},405);
  if(!enabled)return out({error:'unavailable'},503);
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))return out({error:'invalid_request'},400);
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];if(!token)return out({error:'unauthenticated'},401);
  let user;try{user=await verifySession(token);}catch{return out({error:'unavailable'},503);}
  if(!uuid(user?.id)||user.is_anonymous===true||user.aud!=='authenticated'||(user.banned_until&&(!Number.isFinite(Date.parse(user.banned_until))||Date.parse(user.banned_until)>Date.now())))return out({error:'unauthenticated'},401);
  try{if(!await allowRequest({request:req,userId:user.id}))return out({error:'rate_limited'},429);}catch{return out({error:'unavailable'},503);}
  let body;try{const raw=await req.text();if(new TextEncoder().encode(raw).length>1024)throw Error();body=JSON.parse(raw);}catch{return out({error:'invalid_request'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||body.confirm!=='회원탈퇴')return out({error:'confirmation_required'},400);
  try {const result=await deleteMember(user.id);if(result==='blocked')return out({error:'deletion_blocked'},409);if(result!=='deleted')return out({error:'unavailable'},503);return out({deleted:true},200);}catch{return out({error:'unavailable'},503);}
 };
}
