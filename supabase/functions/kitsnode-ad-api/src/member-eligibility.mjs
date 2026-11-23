// Server-side membership gate. Service client must remain server-only; caller
// must first validate the identity with Supabase Auth getUser(token).
export function createMemberEligibility(client,{termsVersion,privacyVersion,requireEmailProfile=false}) {
 if(typeof client?.from!=='function'||typeof termsVersion!=='string'||!termsVersion||typeof privacyVersion!=='string'||!privacyVersion)throw new TypeError('invalid_dependencies');
 return async userId=>{
  if(typeof userId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId))return false;
  try {const {data,error}=await client.from('kitsnode_member_consents').select('user_id,accepted_at').eq('user_id',userId).eq('terms_version',termsVersion).eq('privacy_version',privacyVersion).maybeSingle();if(error||data?.user_id!==userId||typeof data.accepted_at!=='string'||!Number.isFinite(Date.parse(data.accepted_at)))return false;if(!requireEmailProfile)return true;const status=await client.rpc('kitsnode_email_profile_pending_for_service',{p_user:userId});return !status.error&&status.data===false;}
  catch{return false;}
 };
}
