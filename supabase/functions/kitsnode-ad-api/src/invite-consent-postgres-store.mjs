// Candidate for a privileged, parameterized Postgres connection owned by the
// backend; these private functions must never be exposed as browser RPC.
export function createInviteConsentPostgresStore(db) {
 if(typeof db?.query!=='function')throw TypeError('invalid_database');
 const args=x=>[x.consentId,x.userId,x.sessionId,x.accountId,x.version,x.policyDigest];
 const invoke=async(name,x,extra,field)=>{const params=[...args(x),...extra];const placeholders=params.map((_,i)=>`$${i+1}`).join(',');const r=await db.query(`select kitsnode_ads_private.${name}(${placeholders}) as value`,params);if(r?.rows?.length!==1||typeof r.rows[0]?.value!==field)throw Error('store_failed');return r.rows[0].value;};
 return Object.freeze({
  async record(x){if(await invoke('record_invite_consent_candidate',x,[],'string')!==x.consentId)throw Error('record_failed');},
  async reserve(x){return invoke('reserve_invite_consent_candidate',x,[x.reservationId],'boolean');},
  async beginSend(x){return invoke('begin_invite_send_candidate',x,[x.reservationId],'boolean');},
  async release(x){return invoke('release_invite_consent_candidate',x,[x.reservationId],'boolean');}
 });
}
