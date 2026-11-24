// Candidate only: trusted server dependencies; not wired to an HTTP route.
// Shared Naver access does not establish that the member owns the account.
const account = v => typeof v === 'string' && /^[1-9]\d{0,15}$/.test(v);
const identity = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
export function createAutoConnectCandidate({verifySession, store, resolveAccount}) {
 if(typeof verifySession!=='function'||typeof resolveAccount!=='function'||typeof store?.getOwned!=='function'||typeof store?.approveVerified!=='function') throw new TypeError('invalid_dependencies');
 return async function check(token, requestId) {
  if(!identity(requestId)) return {ok:false,code:'invalid_input'};
  try {
   const user=await verifySession(token);
   if(!user || !identity(user.id)) return {ok:false,code:'unauthenticated'};
   const row=await store.getOwned({userId:user.id,requestId});
   if(!row || row.userId!==user.id || row.requestId!==requestId || !account(row.adAccountId)) return {ok:false,code:'not_found'};
   if(row.status==='read_connected') return {ok:true,status:'read_connected'};
   if(row.status!=='pending_review' || !Number.isSafeInteger(row.revision) || row.revision<0) return {ok:false,code:'not_pending'};
   const naver=await resolveAccount(row.adAccountId);
   if(!naver?.ok || naver.adAccountId!==row.adAccountId || !account(naver.customerId) || !['OWNER','MASTER','READ_ONLY'].includes(naver.role)) return {ok:false,code:'naver_access_unverified'};
   // Store must atomically revalidate request identity, account, pending
   // status and revision before committing.
   const committed=await store.approveVerified({userId:user.id,requestId,adAccountId:row.adAccountId,expectedRevision:row.revision,customerId:naver.customerId,naverRole:naver.role});
   return committed===true?{ok:true,status:'read_connected'}:{ok:false,code:'conflict'};
  } catch {return {ok:false,code:'unavailable'};}
 };
}
