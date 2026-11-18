// Candidate server-only adapter. It requires the unapplied invite migration;
// callers must authenticate the principal and prove ownership independently.
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const account = v => typeof v === 'string' && /^[1-9][0-9]{0,15}$/.test(v);
const revision = v => typeof v === 'string' && /^\d+:\d+$/.test(v);
const recipient = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(v);
export function createSupabaseInviteStore(client) {
 if (!client || typeof client.rpc !== 'function') throw TypeError('invalid_rpc_client');
 async function rpc(name,args) { const r=await client.rpc(name,args); if (!r || r.error) throw Error('unavailable'); return r.data; }
 async function flag(name,args) {const result=await rpc(name,args);if(typeof result!=='boolean')throw Error('invalid_response');return result;}
 function ids(requestId,userId){if(!uuid(requestId)||!uuid(userId))throw TypeError('invalid_identity');}
 return Object.freeze({
  async consent({requestId,userId,recipientId,role}) {ids(requestId,userId);if(!recipient(recipientId)||role!=='OPERATIONS_MANAGER')throw TypeError('invalid_input');return flag('kits_ads_invite_consent',{p_request_id:requestId,p_user_id:userId,p_recipient_id:recipientId,p_role:role});},
  async revoke({requestId,userId}) {ids(requestId,userId);return flag('kits_ads_invite_revoke',{p_request_id:requestId,p_user_id:userId});},
  async getJob(requestId) {
   if(!uuid(requestId))throw TypeError('invalid_identity');
   const rows=await rpc('kits_ads_invite_job',{p_request_id:requestId});
   if(!Array.isArray(rows)||rows.length>1)throw Error('invalid_response');
   if(!rows.length)return null;
   const r=rows[0];if(!uuid(r.user_id)||!account(r.ad_account_id)||!['pending_review','read_connected','disconnected'].includes(r.state)||typeof r.consent!=='boolean'||!revision(r.revision))throw Error('invalid_response');
   return {userId:r.user_id,adAccountId:r.ad_account_id,state:r.state,consent:r.consent,revision:r.revision};
  },
  async reserve({requestId,userId,adAccountId,revision:rev,recipientId,role}) {
   ids(requestId,userId);if(!account(adAccountId)||!revision(rev)||!recipient(recipientId)||role!=='OPERATIONS_MANAGER')throw TypeError('invalid_input');
   return flag('kits_ads_invite_reserve',{p_request_id:requestId,p_user_id:userId,p_ad_account_id:adAccountId,p_revision:rev,p_recipient_id:recipientId,p_role:role});
  },
  async finish(requestId,outcome) {if(!uuid(requestId)||!['blocked','uncertain','pending_review'].includes(outcome))throw TypeError('invalid_input'); if(!await flag('kits_ads_invite_finish',{p_request_id:requestId,p_outcome:outcome}))throw Error('audit_unconfirmed');},
 });
}
