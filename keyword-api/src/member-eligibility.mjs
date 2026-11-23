// Server-side membership gate. Service client must remain server-only; caller
// must first validate the identity with Supabase Auth getUser(token).
export function createMemberEligibility(client,{termsVersion,privacyVersion}) {
 if(typeof client?.from!=='function'||typeof termsVersion!=='string'||!termsVersion||typeof privacyVersion!=='string'||!privacyVersion)throw new TypeError('invalid_dependencies');
 return async userId=>{
  if(typeof userId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId))return false;
  try {const pairs=[[termsVersion,privacyVersion]];if(termsVersion==='2026-11-14'&&privacyVersion==='2026-11-14-naver')pairs.push(['2026-11-23','2026-11-23']);for(const [terms,privacy] of pairs){const {data,error}=await client.from('kitsnode_member_consents').select('user_id,accepted_at').eq('user_id',userId).eq('terms_version',terms).eq('privacy_version',privacy).maybeSingle();if(error)return false;if(data?.user_id===userId&&typeof data.accepted_at==='string'&&Number.isFinite(Date.parse(data.accepted_at)))return true}return false;}
  catch{return false;}
 };
}
