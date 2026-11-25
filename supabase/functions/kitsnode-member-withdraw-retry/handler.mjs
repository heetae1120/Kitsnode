const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function equal(a,b){const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
// This endpoint is for a scheduler with a separate server-side secret only.
export function createRetryHandler({secret,intent,withdraw,pageSize=1,maxPages=1}){
 if(typeof secret!=='string'||secret.length<43||typeof intent?.pending!=='function'||typeof intent?.retryCursor!=='function'||typeof intent?.setRetryCursor!=='function'||typeof withdraw!=='function'||!Number.isInteger(pageSize)||pageSize<1||pageSize>100||!Number.isInteger(maxPages)||maxPages<1||maxPages>10)throw Error('invalid_configuration');
 return async req=>{
  const reply=(x,status)=>Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST')return reply({error:'not_found'},404);
  const auth=req.headers.get('authorization')||'';if(auth.length>256||!auth.startsWith('Bearer ')||!await equal(auth.slice(7),secret))return reply({error:'forbidden'},403);
  let processed=0,completed=0;
  try{let cursor=await intent.retryCursor();for(let page=0;page<maxPages;page++){
   const rows=await intent.pending(pageSize,cursor);if(!Array.isArray(rows)||rows.length>pageSize)throw Error('unavailable');
   for(const row of rows){const result=await withdraw(row.subject);processed++;if(result?.status==='complete')completed++;}
   if(rows.length<pageSize){await intent.setRetryCursor(null);break;}
   cursor=rows[rows.length-1].requestId;await intent.setRetryCursor(cursor);
  }return reply({ok:true,processed,completed},200)}catch{return reply({error:'unavailable'},503)}
 };
}
