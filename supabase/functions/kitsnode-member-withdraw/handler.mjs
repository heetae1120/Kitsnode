const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
// Supply real authentication and deletion adapters before deployment. The
// client never chooses the account ID; it comes only from getUser(token).
export function createSelfWithdrawalHandler({origin,verifyUser,withdraw}) {
 if(typeof origin!=='string'||new URL(origin).origin!==origin||new URL(origin).protocol!=='https:'||typeof verifyUser!=='function'||typeof withdraw!=='function')throw Error('invalid_configuration');
 return async request=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const requestOrigin=request.headers.get('origin');
  if(requestOrigin!==origin)return Response.json({error:'forbidden'},{status:403,headers});
  Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(request.method))return Response.json({error:'method_not_allowed'},{status:405,headers});
  try {
   const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('authorization')||'')?.[1];
   if(!token||token.length>8192)return Response.json({error:'unauthenticated'},{status:401,headers});
   const user=await verifyUser(token);
   if(!uuid(user?.id))return Response.json({error:'unauthenticated'},{status:401,headers});
   if(request.method==='GET')return Response.json({available:true},{status:200,headers});
   if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return Response.json({error:'invalid_request'},{status:400,headers});
   const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>256))return Response.json({error:'invalid_request'},{status:400,headers});
   if(!request.body)return Response.json({error:'invalid_request'},{status:400,headers});
   const reader=request.body.getReader(),parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256){await reader.cancel();return Response.json({error:'invalid_request'},{status:400,headers})}parts.push(value)}}finally{reader.releaseLock()}
   const all=new Uint8Array(size);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length}let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{return Response.json({error:'invalid_request'},{status:400,headers});}
   if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).join(',')!=='confirmation'||body.confirmation!=='withdraw')return Response.json({error:'invalid_request'},{status:400,headers});
   const result=await withdraw(user.id);
   if(result?.status==='complete')return Response.json({status:'complete'},{status:200,headers});
   if(result?.status==='pending')return Response.json({status:'pending'},{status:202,headers});
   return Response.json({error:'unavailable'},{status:503,headers});
  }catch{return Response.json({error:'unavailable'},{status:503,headers})}
 };
}
