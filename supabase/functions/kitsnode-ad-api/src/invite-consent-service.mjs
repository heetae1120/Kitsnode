// Isolated candidate. Not mounted as an HTTP route or connected to production.
// verifySession must verify identity AND that the returned sessionId is active;
// decoding unverified JWTs or trusting a browser-supplied session ID is unsafe.
const uuid = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const account = s => typeof s === 'string' && /^[1-9][0-9]{0,15}$/.test(s);
const hash = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const version = s => typeof s === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(s);
export function createInviteConsentService({verifySession,store,newId,consentVersion,policyDigest}) {
 if(typeof verifySession!=='function'||typeof newId!=='function'||!store||!['record','reserve','beginSend','release'].every(x=>typeof store[x]==='function')||!version(consentVersion)||!hash(policyDigest)) throw TypeError('invalid_dependencies');
 async function principal(session){try{const user=await verifySession(session);return uuid(user?.id)&&uuid(user?.sessionId)?{userId:user.id,sessionId:user.sessionId}:null;}catch{return null;}}
 const validInput = x=> x && uuid(x.consentId)&&account(x.accountId);
 const bound=(p,input)=>({...p,consentId:input.consentId,accountId:input.accountId,version:consentVersion,policyDigest});
 return Object.freeze({
  async record(session,input) {
   const p=await principal(session);if(!p)return {ok:false,code:'unauthenticated'};
   if(!input||Object.keys(input).sort().join(',')!=='accepted,accountId,policyDigest,version'||!account(input.accountId)||input.accepted!==true||input.version!==consentVersion||input.policyDigest!==policyDigest)return {ok:false,code:'invalid_consent'};
   const consentId=newId();if(!uuid(consentId))return {ok:false,code:'unavailable'};
   try{await store.record({...bound(p,{consentId,accountId:input.accountId}),recipient:'kitsnode',role:'OPERATIONS_VIEWER',autoPolicy:true});return {ok:true,consentId};}catch{return {ok:false,code:'unavailable'};}
  },
  // The trusted server must create one reservation; a browser value is never a grant.
  async reserve(session,input) {
   const p=await principal(session);if(!p)return {ok:false,code:'unauthenticated'};
   if(!validInput(input))return {ok:false,code:'invalid_input'};
   const reservationId=newId();if(!uuid(reservationId))return {ok:false,code:'unavailable'};
   try{return await store.reserve({...bound(p,input),reservationId})===true?{ok:true,reservationId}:{ok:false,code:'invalid_or_reserved'};}catch{return {ok:false,code:'unavailable'};}
  },
  // MUST commit before any external invite invocation. Once committed, crash,
  // timeout or uncertain result cannot release or retry automatically.
  async beginSend(session,input) {
   const p=await principal(session);if(!p)return {ok:false,code:'unauthenticated'};
   if(!validInput(input)||!uuid(input.reservationId))return {ok:false,code:'invalid_input'};
   try{return await store.beginSend({...bound(p,input),reservationId:input.reservationId})===true?{ok:true}:{ok:false,code:'invalid_or_attempted'};}catch{return {ok:false,code:'unavailable'};}
  },
  // Safe ONLY when caller knows beginSend was never committed and no request
  // was sent. If beginSend returned an error/timeout, the result is ambiguous:
  // do not release. A reconciliation protocol is still required.
  async releaseBeforeSend(session,input) {
   const p=await principal(session);if(!p)return {ok:false,code:'unauthenticated'};
   if(!validInput(input)||!uuid(input.reservationId))return {ok:false,code:'invalid_input'};
   try{return await store.release({...bound(p,input),reservationId:input.reservationId})===true?{ok:true}:{ok:false,code:'invalid_or_attempted'};}catch{return {ok:false,code:'unavailable'};}
  }
 });
}
