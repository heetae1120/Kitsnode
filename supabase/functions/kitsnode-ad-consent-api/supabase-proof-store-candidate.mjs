// ISOLATED CANDIDATE. Backend service-role only; never expose this client or
// mount the proof endpoints without independently verifying deployment, origin and consent scope.
import {NAVER_POLICY_VERSION,NAVER_POLICY_DIGEST} from './consent-proof-bridge.mjs';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const key=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x);
const account=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const viewer=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x)&&x!=='kitsnode';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const version=x=>typeof x==='string'&&/^[A-Za-z0-9._-]{1,64}$/.test(x);
export function createSupabaseProofStore(client){
 if(typeof client?.rpc!=='function')throw TypeError('invalid_client');
 const call=async(n,p)=>{const r=await client.rpc(n,p);if(!r||r.error)throw Error('unavailable');return r.data};
 const params=r=>({p_request:r.request.requestId,p_consent:r.request.consentId,p_user:r.userId,p_session:r.sessionId,p_account:r.request.accountId,p_viewer:r.request.viewerId,p_evidence:null,p_version:r.request.consentVersion,p_digest:r.request.consentDigest.slice(7),p_key_x:r.request.publicKey.x,p_key_y:r.request.publicKey.y});
 return Object.freeze({
  async recordViewer({evidenceId,userId,accountId,viewerId,ownershipEvidenceId,proofRef,operatorId,operatorSessionId,expiresAt}){
   if(!uuid(evidenceId)||!uuid(userId)||!account(accountId)||!viewer(viewerId)||!uuid(ownershipEvidenceId)||typeof proofRef!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(proofRef)||!uuid(operatorId)||!uuid(operatorSessionId)||!Number.isSafeInteger(expiresAt))return false;
   return (await call('kits_invite_viewer_record_candidate',{p_id:evidenceId,p_user:userId,p_account:accountId,p_viewer:viewerId,p_owner_evidence:ownershipEvidenceId,p_proof_ref:proofRef,p_operator:operatorId,p_operator_session:operatorSessionId,p_expiry:new Date(expiresAt).toISOString()}))===true;
  },
  async readConsent({consentId,userId,sessionId,accountId}){
   if(!uuid(consentId)||!uuid(userId)||!uuid(sessionId)||!account(accountId))return null;
   const r=await call('kits_invite_consent_read_candidate',{p_consent:consentId,p_user:userId,p_session:sessionId,p_account:accountId});
   if(r===null)return null;if(r.consentId!==consentId||r.userId!==userId||r.sessionId!==sessionId||r.accountId!==accountId||!Number.isSafeInteger(r.expiresAt)||!version(r.consentVersion)||!/^sha256:[a-f0-9]{64}$/.test(r.consentDigest||'')||r.recipientId!=='kitsnode'||r.role!=='OPERATIONS_VIEWER'||r.autoPolicy!==true)throw Error('invalid_response');return r;
  },
  async verifyViewer({userId,accountId,viewerId}){
   if(!uuid(userId)||!account(accountId)||!viewer(viewerId))return null;
   const evidenceId=await call('kits_invite_viewer_find_candidate',{p_user:userId,p_account:accountId,p_viewer:viewerId});
   if(evidenceId===null)return null;if(!uuid(evidenceId))throw Error('invalid_response');return {evidenceId};
  },
  async createAuthorized({request,session,consent,expiresAt}){
   if(!uuid(request?.requestId)||!uuid(request?.consentId)||!uuid(session?.userId)||!uuid(session?.sessionId)||!account(request?.accountId)||!viewer(request?.viewerId)||!version(request?.consentVersion)||!/^sha256:[a-f0-9]{64}$/.test(request?.consentDigest||'')||!key(request?.publicKey?.x)||!key(request?.publicKey?.y)||request.publicKey.kty!=='EC'||request.publicKey.crv!=='P-256'||request.publicKey.d!==undefined||consent?.consentId!==request.consentId||!Number.isSafeInteger(expiresAt))return false;
   const r={request,userId:session.userId,sessionId:session.sessionId,evidenceId:null};
   return (await call('kits_invite_proof_approve_candidate',{...params(r),p_expiry:new Date(expiresAt).toISOString()}))===true;
  },
  async get(requestId){
   if(!uuid(requestId))return null;const r=await call('kits_invite_proof_get_candidate',{p_request:requestId});
   if(!r)return null;if(!uuid(r.requestId)||r.requestId!==requestId||!uuid(r.consentId)||!uuid(r.userId)||!uuid(r.sessionId)||r.evidenceId!==null||!account(r.accountId)||!viewer(r.viewerId)||!version(r.consentVersion)||!hash(r.policyDigest)||!key(r.keyX)||!key(r.keyY)||!['approved','reserved','begun'].includes(r.state))throw Error('invalid_response');
   return {userId:r.userId,sessionId:r.sessionId,evidenceId:r.evidenceId,state:r.state,request:{requestId:r.requestId,consentId:r.consentId,accountId:r.accountId,viewerId:r.viewerId,consentVersion:r.consentVersion,consentDigest:'sha256:'+r.policyDigest,recipientId:'kitsnode',role:'OPERATIONS_VIEWER',autoPolicy:true,naverPolicyVersion:NAVER_POLICY_VERSION,naverPolicyDigest:NAVER_POLICY_DIGEST,publicKey:{kty:'EC',crv:'P-256',x:r.keyX,y:r.keyY}}};
  },
  async transitionAuthorized({operation,expected}){
   if(!['redeem','begin_send'].includes(operation)||!expected?.request)return false;
   return (await call('kits_invite_proof_transition_candidate',{...params(expected),p_operation:operation}))===true;
  }
 });
}
