// The target is always the server-verified identity associated with the token.
export async function selfWithdrawalAvailable(client,expectedUserId) {
 if(!client||!expectedUserId)return false;
 try {
  const s=await client.auth.getSession(),token=s?.data?.session?.access_token;
  if(s?.error||!token||s.data.session.user?.id!==expectedUserId)return false;
  const r=await client.functions.invoke('kitsnode-member-withdraw',{method:'GET',headers:{Authorization:`Bearer ${token}`}});
  return !r?.error&&r?.data?.available===true;
 }catch{return false}
}
export async function requestSelfWithdrawal(client,expectedUserId,onComplete=()=>{}) {
 if(!client || typeof expectedUserId!=='string' || !expectedUserId) return {ok:false,code:'unauthenticated'};
 try {
  const sessionResult=await client.auth.getSession();
  const token=sessionResult?.data?.session?.access_token;
  if(sessionResult?.error || typeof token!=='string' || !token) return {ok:false,code:'unauthenticated'};
  const identity=await client.auth.getUser(token);
  if(identity?.error || identity?.data?.user?.id!==expectedUserId) return {ok:false,code:'session_changed'};
  const response=await client.functions.invoke('kitsnode-member-withdraw',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:{confirmation:'withdraw'}});
  if(response?.error) return {ok:false,code:'unavailable'};
  if(response?.data?.status==='complete') { try { onComplete(); } catch {} try { await client.auth.signOut({scope:'local'}); } catch {} return {ok:true,code:'complete'}; }
  if(response?.data?.status==='pending') return {ok:false,code:'pending'};
  if(response?.data?.status==='admin_protected'||response?.data?.status==='staff_linked') return {ok:false,code:response.data.status};
  return {ok:false,code:'unavailable'};
 } catch {return {ok:false,code:'unavailable'};}
}
