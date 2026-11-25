import {randomUUID} from 'node:crypto';

// Domain service: dependencies must be trusted server-side implementations.
// There is deliberately no browser-facing HTTP route or credential storage here.
// Store methods must enforce the atomic contracts documented below.
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const account = value => typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value);
const evidence = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const result = code => ({ok:false,code});

export function createConnectionService({verifySession, verifyOperator, verifyOwnershipEvidence, resolveAccount, store, createId=randomUUID}) {
  if (![verifySession,verifyOperator,verifyOwnershipEvidence,resolveAccount,createId].every(f=>typeof f==='function') || !store || !['createPending','getOwned','getForReview','approvePending','disconnectOwned'].every(k=>typeof store[k]==='function')) throw new TypeError('invalid_dependencies');
  async function principal(session) {
    try {
      const user=await verifySession(session);
      return user && id(user.id) ? user : null;
    } catch {return null;}
  }
  return Object.freeze({
    async request(session, adAccountId) {
      const user=await principal(session);
      if (!user) return result('unauthenticated');
      if (!account(adAccountId)) return result('invalid_input');
      const requestId=createId();
      if (!id(requestId)) return result('unavailable');
      // Atomic store operation: prevent multiple active claims for the same
      // account, set pending_review, derive user exclusively from the session.
      try {
        const created=await store.createPending({requestId,userId:user.id,adAccountId});
        if (!created) return result('conflict');
        return {ok:true,requestId,status:'pending_review'};
      } catch{return result('unavailable');}
    },
    async get(session, requestId) {
      const user=await principal(session);
      if (!user) return result('unauthenticated');
      if (!id(requestId)) return result('invalid_input');
      try {
        const row=await store.getOwned({requestId,userId:user.id});
        if (!row || row.userId!==user.id || row.requestId!==requestId) return result('not_found');
        // Do not leak customer IDs, evidence, or operator identity.
        return {ok:true,requestId:row.requestId,adAccountId:row.adAccountId,status:row.status};
      } catch{return result('unavailable');}
    },
    async approve(session, requestId, evidenceRef) {
      const user=await principal(session);
      if (!user) return result('unauthenticated');
      if (!id(requestId) || !evidence(evidenceRef)) return result('invalid_input');
      try {
        // Operator privileges and evidence are checked server-side, never from
        // booleans or account details supplied by the requester.
        if (await verifyOperator(user.id)!==true) return result('forbidden');
        const row=await store.getForReview({requestId});
        if (!row || row.requestId!==requestId || !id(row.userId) || !account(row.adAccountId) || row.status!=='pending_review' || !Number.isSafeInteger(row.revision) || row.revision<0) return result('not_found');
        if (await verifyOwnershipEvidence({requestId,userId:row.userId,adAccountId:row.adAccountId,evidenceRef,operatorId:user.id})!==true) return result('ownership_unverified');
        const mapped=await resolveAccount(row.adAccountId);
        if (!mapped?.ok || mapped.adAccountId!==row.adAccountId || !account(mapped.customerId) || !['OWNER','MASTER','READ_ONLY'].includes(mapped.role)) return result('naver_access_unverified');
        // Must be an atomic compare-and-swap of request ID + pending status +
        // revision + owner + account; concurrent revocation/changes fail.
        const committed=await store.approvePending({requestId,userId:row.userId,adAccountId:row.adAccountId,expectedRevision:row.revision,customerId:mapped.customerId,naverRole:mapped.role,operatorId:user.id,evidenceRef});
        return committed===true ? {ok:true,status:'read_connected'} : result('conflict');
      } catch {return result('unavailable');}
    },
    async disconnect(session, requestId) {
      const user=await principal(session);
      if (!user) return result('unauthenticated');
      if (!id(requestId)) return result('invalid_input');
      // Must atomically revoke connection AND disable all its bid rules. Caller
      // must also recheck connection immediately before any future write.
      try {return await store.disconnectOwned({requestId,userId:user.id})===true ? {ok:true,status:'disconnected'} : result('not_found');}
      catch {return result('unavailable');}
    }
  });
}
