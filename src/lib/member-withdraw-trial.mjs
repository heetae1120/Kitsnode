// Temporary test-only route. The server binds the trial to one authorized test
// account; the browser never sends an account ID as the deletion target.
const endpoint='kitsnode-member-withdraw-trial';
export async function trialWithdrawalAvailable(client,expectedUserId){
 if(!client||!expectedUserId)return false;
 try{const s=await client.auth.getSession(),token=s?.data?.session?.access_token;if(s?.error||!token||s.data.session.user?.id!==expectedUserId)return false;
  const r=await client.functions.invoke(endpoint,{method:'GET',headers:{Authorization:`Bearer ${token}`}});return !r?.error&&r?.data?.available===true;
 }catch{return false}
}
export async function requestTrialWithdrawal(client,expectedUserId,onComplete=()=>{}){
 if(!client||!expectedUserId)return {ok:false,code:'unauthenticated'};
 let submitted=false;
 try{const s=await client.auth.getSession(),token=s?.data?.session?.access_token;if(s?.error||!token||s.data.session.user?.id!==expectedUserId)return {ok:false,code:'session_changed'};
  const user=await client.auth.getUser(token);if(user?.error||user?.data?.user?.id!==expectedUserId)return {ok:false,code:'session_changed'};
  submitted=true;const r=await client.functions.invoke(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:{confirmation:'withdraw'}});
  if(r?.error)return {ok:false,code:'pending'};
  if(r?.data?.status==='complete'){try{onComplete()}catch{}try{await client.auth.signOut({scope:'local'})}catch{}return {ok:true,code:'complete'}}
  if(['admin_protected','protected_reference'].includes(r?.data?.status))return {ok:false,code:r.data.status};
  return {ok:false,code:'pending'};
 }catch{return {ok:false,code:submitted?'pending':'unavailable'}}
}
