// Server only: never return or log the resolved email or password.
const uname=x=>typeof x==='string'?x.trim().toLowerCase():'';
const valid=x=>/^[a-z0-9][a-z0-9_-]{3,19}$/.test(x);
export function createUsernameHandler({origin,limit,lookup,login,revokeSession,dummyEmail,pending}={}) {
 let u;try{u=new URL(origin)}catch{throw TypeError('invalid_origin')}
 if(u.origin!==origin||(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))||typeof revokeSession!=='function'||typeof limit!=='function'||typeof lookup!=='function'||typeof login!=='function'||typeof dummyEmail!=='function')throw TypeError('invalid_dependencies');
 return async request=>{
  const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin'};
  if(request.headers.get('origin')!==origin)return Response.json({ok:false,code:'unavailable'},{status:403,headers});headers['access-control-allow-origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, apikey, authorization'}});
  if(request.method!=='POST'||!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type')||''))return Response.json({ok:false,code:'invalid_input'},{status:400,headers});
  try{
   const size=request.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>4096))throw Error('body');
   if(!request.body)throw Error('body');const reader=request.body.getReader();let n=0,chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>4096)throw Error('body');chunks.push(value)}}finally{reader.releaseLock()}
   const bytes=new Uint8Array(n);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   const kind=body?.action;
   if(kind==='resume'){
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof body.password!=='string'||!body.password||body.password.length>72||typeof pending!=='function')return Response.json({ok:false,code:'sign_in_failed'},{headers});
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email))),x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
    if(await limit({kind:'login',username:digest})!==true)return Response.json({ok:false,code:'unavailable'},{status:429,headers});
    const result=await login(email,body.password);let allowed=false;
    try{allowed=Boolean(result?.user?.id&&result.user.email_confirmed_at&&result.session?.access_token&&result.session?.refresh_token&&await pending(result.user.id))}catch{}
    if(!allowed){if(result?.session?.access_token){try{await revokeSession(result.session)}catch{}}return Response.json({ok:false,code:'sign_in_failed'},{headers})}
    return Response.json({ok:true,code:'signed_in',session:{access_token:result.session.access_token,refresh_token:result.session.refresh_token}},{headers});
   }
   const username=uname(body?.username);if(!valid(username)||!['availability','login'].includes(kind))return Response.json({ok:false,code:'invalid_input'},{status:400,headers});
   if(await limit({kind,username})!==true)return Response.json({ok:false,code:'unavailable'},{status:429,headers});
   const match=await lookup(username);
   if(kind==='availability')return Response.json({ok:true,code:match?'unavailable':'available'},{headers});
   if(typeof body.password!=='string'||!body.password||body.password.length>72)return Response.json({ok:false,code:'sign_in_failed'},{headers});
   const result=await login(match?.email||dummyEmail(),body.password);if(!match||!result?.user||result.user.id!==match.userId||!result.user.email_confirmed_at||!result.session?.access_token||!result.session?.refresh_token){if(result?.session?.access_token){try{await revokeSession(result.session)}catch{}}return Response.json({ok:false,code:'sign_in_failed'},{headers});}
   return Response.json({ok:true,code:'signed_in',session:{access_token:result.session.access_token,refresh_token:result.session.refresh_token}},{headers});
  }catch{return Response.json({ok:false,code:'unavailable'},{status:503,headers})}
 };
}
