const missing=e=>e?.status===404&&e?.code==='user_not_found';
// Operates on the authenticated subject only. The caller must first write the
// durable intent and must wire employee-site cleanup into deleteRelated.
export function createSelfSupabaseAdapter(client,{now=Date.now}={}) {
 if(typeof client?.rpc!=='function'||!client?.auth?.admin)throw Error('invalid_client');
 const admin=client.auth.admin;
 const rpc=async(step,{subject,requestId})=>{
  const {data,error}=await client.rpc('kits_member_deletion_step',{p_step:step,p_subject:subject,p_request:requestId});
  if(error||typeof data!=='string')throw Error('storage_unavailable');
  return data;
 };
 async function absent(subject){const result=await admin.getUserById(subject);if(missing(result?.error))return true;if(result?.error||result?.data?.user?.id!==subject)throw Error('auth_unavailable');return false}
 return {
  async blockAccess(ctx){
   if(await rpc('reserve',ctx)!=='reserved')return false;
   if(await absent(ctx.subject))return true;
   const r=await admin.updateUserById(ctx.subject,{ban_duration:'876000h'}),user=r?.data?.user;
   return !r?.error&&user?.id===ctx.subject&&Number.isFinite(Date.parse(user.banned_until))&&Date.parse(user.banned_until)>now();
  },
  async stopAds(ctx){return await rpc('stop_ads',ctx)},
  async cleanupDatabase(ctx){
   if(await rpc('cleanup_ads',ctx)!=='cleaned'||await rpc('cleanup_staff',ctx)!=='cleaned')return false;
   if(await absent(ctx.subject))return true;
   return await rpc('cleanup_sessions',ctx)==='sessions_removed';
  },
  async deleteAuth(ctx){
   if(await absent(ctx.subject))return true;
   const r=await admin.deleteUser(ctx.subject,false);
   if(r?.error&&!missing(r.error))return false;
   return await absent(ctx.subject);
  },
  async verifyDatabase(ctx){return await absent(ctx.subject)&&await rpc('verify',ctx)==='cleaned'}
 };
}
