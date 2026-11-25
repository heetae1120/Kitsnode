// Session IDs decoded here are used only after getUser has verified the same
// token; isActive must query trusted server state (for example auth.sessions),
// fail closed on errors, and must not accept browser-supplied session IDs.
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function createActiveSessionVerifier({authClient,isActive,now=Date.now}) {
 if(typeof authClient?.auth?.getUser!=='function'||typeof isActive!=='function'||typeof now!=='function')throw TypeError('invalid_dependencies');
 return async token=>{
  if(typeof token!=='string'||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token)||token.length>8192)return null;
  try {
   const {data,error}=await authClient.auth.getUser(token),u=data?.user;
   if(error||!uuid(u?.id)||u.aud!=='authenticated'||u.is_anonymous===true||(u.banned_until&&(!Number.isFinite(Date.parse(u.banned_until))||Date.parse(u.banned_until)>now())))return null;
   const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const payload=JSON.parse(atob(raw.padEnd(Math.ceil(raw.length/4)*4,'=')));
   if(!payload||payload.sub!==u.id||!uuid(payload.session_id)||payload.aud!=='authenticated'||!Number.isSafeInteger(payload.exp)||payload.exp*1000<=now())return null;
   if(await isActive({userId:u.id,sessionId:payload.session_id})!==true)return null;
   return {id:u.id,sessionId:payload.session_id};
  }catch{return null;}
 };
}
