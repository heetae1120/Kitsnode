// Server-only adapter for service-role RPCs. The public RPC functions are
// EXECUTE-revoked from anon/authenticated and check active auth.sessions.
export function createSupabaseInviteStore(client){
 if(typeof client?.rpc!=='function')throw TypeError('invalid_client');
 const invoke=async(name,args)=>{const r=await client.rpc(name,args);if(!r||r.error)throw Error('unavailable');return r.data};
 const params=x=>({p_id:x.consentId,p_user:x.userId,p_session:x.sessionId,p_account:x.accountId,p_version:x.version,p_digest:x.policyDigest});
 const bool=x=>{if(typeof x!=='boolean')throw Error('invalid_response');return x};
 return Object.freeze({
  async isActive({userId,sessionId}){return bool(await invoke('kits_invite_active_session',{p_user:userId,p_session:sessionId}));},
  async record(x){if(await invoke('kits_invite_record',params(x))!==x.consentId)throw Error('record_failed');},
  async reserve(x){return bool(await invoke('kits_invite_reserve',{...params(x),p_reservation:x.reservationId}));},
  async beginSend(x){return bool(await invoke('kits_invite_begin',{...params(x),p_reservation:x.reservationId}));},
  async release(x){return bool(await invoke('kits_invite_release',{...params(x),p_reservation:x.reservationId}));}
 });
}
