import {randomUUID} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const account=v=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v);
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===[...k].sort().join(',');
const statuses=new Set(['none','pending_review','matched']);

// A submitted request is a signal for a human review; it identifies no Naver
// account. Naver access does not prove the relationship with the requester.
export function createManualInviteApp({verifySession,memberAllowed,verifyOperator,allowRequest,resolveAccount,store,origin='https://heetae1120.github.io',createId=randomUUID}){
 if(![verifySession,memberAllowed,verifyOperator,allowRequest,resolveAccount,createId,store?.create,store?.status,store?.queue,store?.attach].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return {handler:async req=>{
  const h={'content-type':'application/json','cache-control':'no-store','vary':'Origin','x-content-type-options':'nosniff'};
  const out=(status,body)=>new Response(JSON.stringify(body),{status,headers:h});
  if(req.headers.get('origin')!==origin)return out(403,{error:'forbidden'});h['access-control-allow-origin']=origin;
  const url=new URL(req.url),isCustomer=url.pathname==='/api/manual-invite-requests',isOperator=url.pathname==='/api/manual-invite-reviews';
  if((!isCustomer&&!isOperator)||url.search||url.hash)return out(404,{error:'not_found'});
  if(req.method==='OPTIONS'){
   const wanted=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(!['GET','POST'].includes(req.headers.get('access-control-request-method'))||wanted.some(x=>!['authorization','content-type'].includes(x)))return out(403,{error:'forbidden'});
   h['access-control-allow-methods']='GET, POST, OPTIONS';h['access-control-allow-headers']='Authorization, Content-Type';return new Response(null,{status:204,headers:h});
  }
  if((isCustomer&&!['GET','POST'].includes(req.method))||(isOperator&&req.method!=='POST'))return out(405,{error:'method_not_allowed'});
  const token=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];
  if(!token)return out(401,{error:'unauthenticated'});
  try{
   const user=await verifySession(token);if(!uuid(user?.id)||!uuid(user?.sessionId))return out(401,{error:'unauthenticated'});
   if(isOperator&&await verifyOperator(user.id)!==true)return out(403,{error:'forbidden'});
   if(isCustomer&&await memberAllowed(user.id)!==true)return out(403,{error:'forbidden'});
   if(await allowRequest(user.id)!==true)return out(429,{error:'rate_limited'});
   if(isCustomer&&req.method==='GET'){
    const status=await store.status(user.id);return statuses.has(status)?out(200,{status}):out(503,{error:'unavailable'});
   }
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return out(400,{error:'invalid_input'});
   let body;try{body=await readLimitedJson(req,1024)}catch{return out(400,{error:'invalid_input'})}
   if(isCustomer){
    if(!exact(body,[]))return out(400,{error:'invalid_input'});
    const id=createId();if(!uuid(id))return out(503,{error:'unavailable'});
    const status=await store.create(id,user.id,user.sessionId);return ['pending_review','matched'].includes(status)?out(200,{status}):out(503,{error:'unavailable'});
   }
   if(exact(body,['action'])&&body.action==='queue'){
    const rows=await store.queue();if(!Array.isArray(rows)||rows.length>100||!rows.every(x=>uuid(x.request_id)&&uuid(x.user_id)&&typeof x.created_at==='string'&&Number.isFinite(Date.parse(x.created_at))))return out(503,{error:'unavailable'});
    return out(200,{requests:rows.map(({request_id,user_id,created_at})=>({request_id,user_id,created_at}))});
   }
   if(exact(body,['action','requestId','adAccountId','confirmed'])&&body.action==='attach'&&uuid(body.requestId)&&account(body.adAccountId)&&body.confirmed===true){
    const resolved=await resolveAccount(body.adAccountId);
    if(!resolved?.ok||resolved.adAccountId!==body.adAccountId||!account(resolved.customerId)||!['OWNER','MASTER','READ_ONLY'].includes(resolved.role))return out(422,{error:'naver_access_unverified'});
    const id=createId();if(!uuid(id))return out(503,{error:'unavailable'});
    const attached=await store.attach(body.requestId,id,user.id,user.sessionId,body.adAccountId);
    return uuid(attached)?out(200,{status:'matched',connectionId:attached}):out(409,{error:'conflict'});
   }
   return out(400,{error:'invalid_input'});
  }catch{return out(503,{error:'unavailable'})}
 }};
}
export function createManualInviteStore(client){
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw Error('unavailable');return data;};
 return {create:(id,user,session)=>rpc('kits_manual_invite_create',{p_id:id,p_user:user,p_session:session}),status:user=>rpc('kits_manual_invite_status',{p_user:user}),queue:()=>rpc('kits_manual_invite_queue',{}),attach:(request,id,operator,session,accountId)=>rpc('kits_manual_invite_attach',{p_request:request,p_connection:id,p_operator:operator,p_session:session,p_account:accountId})};
}
