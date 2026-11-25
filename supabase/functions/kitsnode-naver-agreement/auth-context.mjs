// The JWT payload is used only after Auth validates this same token. The
// session is checked again atomically by the evidence storage transaction.
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export function createNaverAuthContext({authClient,now=Date.now}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof now!=='function')throw TypeError('invalid_dependencies');
 return async token=>{
  if(typeof token!=='string'||token.length>8192||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return null;
  try{
   const {data,error}=await authClient.auth.getUser(token),user=data?.user;
   if(error||!uuid(user?.id)||user.aud!=='authenticated'||user.is_anonymous===true||(user.banned_until&&(!Number.isFinite(Date.parse(user.banned_until))||Date.parse(user.banned_until)>now())))return null;
   const raw=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(atob(raw.padEnd(Math.ceil(raw.length/4)*4,'=')));
   if(claims.sub!==user.id||claims.aud!=='authenticated'||!uuid(claims.session_id)||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=now())return null;
   const ids=(user.identities||[]).filter(i=>i.provider==='custom:naver');
   if(ids.length!==1||typeof ids[0].identity_data?.sub!=='string'||!ids[0].identity_data.sub)return null;
   return {userId:user.id,sessionId:claims.session_id,naverSubject:ids[0].identity_data.sub};
  }catch{return null}
 };
}
