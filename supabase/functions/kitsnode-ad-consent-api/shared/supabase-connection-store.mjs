// Service-role-only RPC adapter for createConnectionService. Values `userId`
// and `operatorId` must originate from verified server identity; the RPCs are
// NOT an authorization boundary and must never be directly exposed to clients.
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const account = v => typeof v === 'string' && /^[1-9][0-9]{0,15}$/.test(v);
const evidence = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const states = new Set(['pending_review','read_connected','disconnected']);
const roles = new Set(['OWNER','MASTER','READ_ONLY']);
const requireId = id => {if(!uuid(id)) throw new TypeError('invalid_identity');};
const revision = v => typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
function mapRow(row,userId) {
 const rev=revision(row?.revision);
 if(!uuid(row?.request_id)||!uuid(userId)||!account(row?.ad_account_id)||!states.has(row?.status)||!Number.isSafeInteger(rev)||rev<0)throw new Error('invalid_response');
 return {requestId:row.request_id,userId,adAccountId:row.ad_account_id,status:row.status,revision:rev};
}
export function createSupabaseConnectionStore(client) {
 if(!client || typeof client.rpc!=='function')throw new TypeError('invalid_rpc_client');
 async function rpc(name,args,{conflict=false}={}) {
  let result;try {result=await client.rpc(name,args);}catch{throw Error('unavailable');}
  if(!result || typeof result!=='object')throw Error('unavailable');
  if(result.error){if(conflict && result.error.code==='23505')return null;throw Error('unavailable');}
  return result.data;
 }
 async function listOwned(userId) {
  requireId(userId);
  const rows=await rpc('kits_ads_list',{p_user_id:userId});
  if(!Array.isArray(rows)||rows.length>100)throw Error('invalid_response');
  return rows.map(row=>mapRow(row,userId));
 }
 return Object.freeze({
  async createPending({requestId,userId,adAccountId}) {
   requireId(requestId);requireId(userId);if(!account(adAccountId))throw Error('invalid_input');
   const created=await rpc('kits_ads_request',{p_request_id:requestId,p_user_id:userId,p_ad_account_id:adAccountId},{conflict:true});
   if(created===null)return false;
   if(created!==requestId)throw Error('invalid_response');
   return true;
  },
  listOwned,
  async getOwned({requestId,userId}) {
   requireId(requestId);const rows=await listOwned(userId);
   const matching=rows.filter(x=>x.requestId===requestId);if(matching.length>1)throw Error('invalid_response');
   return matching[0] ?? null;
  },
  async getForReview({requestId}) {
   requireId(requestId);
   // Only the service-layer operator flow may call this service-role RPC.
   const rows=await rpc('kits_ads_review',{p_request_id:requestId});
   if(!Array.isArray(rows)||rows.length>1)throw Error('invalid_response');
   if(!rows.length)return null;
   return mapRow(rows[0],rows[0].user_id);
  },
  async approvePending({requestId,userId,adAccountId,expectedRevision,customerId,naverRole,operatorId,evidenceRef}) {
   requireId(requestId);requireId(userId);requireId(operatorId);
   if(!account(adAccountId)||!account(customerId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||!roles.has(naverRole)||!evidence(evidenceRef))throw Error('invalid_input');
   const data=await rpc('kits_ads_approve',{p_request_id:requestId,p_user_id:userId,p_ad_account_id:adAccountId,p_revision:expectedRevision,p_customer_id:customerId,p_naver_role:naverRole,p_operator_id:operatorId,p_evidence_ref:evidenceRef});
   if(typeof data!=='boolean')throw Error('invalid_response');return data;
  },
  async disconnectOwned({userId,requestId}) {
   requireId(userId);requireId(requestId);
   const data=await rpc('kits_ads_disconnect',{p_user_id:userId,p_request_id:requestId});
   if(typeof data!=='boolean')throw Error('invalid_response');return data;
  },
 });
}
