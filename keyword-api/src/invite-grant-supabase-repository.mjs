// Candidate adapter for the unapplied SQL fixture. Database time, not the
// caller's clock, controls expiration. Never expose the service-role client.
export function createInviteGrantRepository(client) {
 if(!client||typeof client.rpc!=='function')throw TypeError('invalid_configuration');
 async function rpc(name,args){const r=await client.rpc(name,args);if(!r||r.error)throw Error('unavailable');return r.data;}
 return Object.freeze({
  async insert(x){const v=await rpc('kits_invite_grant_issue',{p_request_id:x.requestId,p_user_id:x.userId,p_session_id:x.sessionId,p_nonce:x.nonce,p_account:x.accountId,p_viewer:x.viewerId,p_revision:x.revision,p_hash:x.secretHash});if(typeof v!=='boolean')throw Error('invalid_response');return v;},
  async consume(x){const rows=await rpc('kits_invite_grant_consume',{p_hash:x.secretHash,p_nonce:x.nonce,p_account:x.accountId,p_viewer:x.viewerId});if(!Array.isArray(rows)||rows.length>1)throw Error('invalid_response');if(!rows.length)return null;const r=rows[0];return {requestId:r.request_id,userId:r.user_id,nonce:r.nonce,accountId:r.account_id,viewerId:r.viewer_id,recipientId:r.recipient_id,role:r.role};}
 });
}
