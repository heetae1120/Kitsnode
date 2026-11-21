import {NAVER_INVITE_POLICY_DIGEST,NAVER_INVITE_POLICY_VERSION} from './naver-invite-policy.mjs';
// Isolated candidate. Not wired to the production UI or worker.
// Only the website contacts the server with the member bearer token.
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/proof/approve';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const uuid4=x=>uuid(x)&&x[14]==='4'&&/[89ab]/i.test(x[19]);
const account=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const viewer=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x)&&x!=='kitsnode';
const extensionId=x=>typeof x==='string'&&/^[a-p]{32}$/.test(x);

export async function approveInviteProofCandidate({consentId,accountId,consentVersion,policyDigest,nonce,extension,runtime,getSession,isCurrent,userId,fetcher=globalThis.fetch,signal,wait=()=>new Promise(resolve=>setTimeout(resolve,500))}={}){
 if(!uuid(consentId)||!account(accountId)||!/^[-A-Za-z0-9._]{1,64}$/.test(consentVersion||'')||!/^[0-9a-f]{64}$/.test(policyDigest||'')||!uuid4(nonce)||!extensionId(extension)||typeof runtime?.sendMessage!=='function'||typeof getSession!=='function'||typeof isCurrent!=='function'||!uuid(userId)||typeof fetcher!=='function'||!signal||signal.aborted)return {status:'blocked'};
 try{
  const current=async()=>{const s=await getSession();const session=s?.data?.session;return !signal.aborted&&session?.user?.id===userId&&isCurrent(userId)===true&&typeof session?.access_token==='string'&&/^[A-Za-z0-9._-]{1,8192}$/.test(session.access_token)?session.access_token:null;};
  const originalToken=await current();if(!originalToken)return {status:'blocked'};
  const sameSession=async()=>await current()===originalToken;
  // consentId is an opaque identifier, not a credential. No bearer/session ID
  // is sent to the extension. The extension must bind it into its signature.
  const fields={nonce,consentId,accountId,consentVersion,consentDigest:`sha256:${policyDigest}`,naverPolicyVersion:NAVER_INVITE_POLICY_VERSION,naverPolicyDigest:`sha256:${NAVER_INVITE_POLICY_DIGEST}`};
  const started=await runtime.sendMessage(extension,{type:'kitsnode.proof.start.v2',...fields});
  if(started?.status!=='started'||!await sameSession())return {status:'blocked'};
  let ready=await runtime.sendMessage(extension,{type:'kitsnode.proof.prepare.v2',...fields});
  for(let i=0;(ready?.status==='selecting'||ready?.status==='pending')&&i<1200;i++){
   if(!await sameSession())return {status:'blocked'};
   await wait();
   ready=await runtime.sendMessage(extension,ready.status==='selecting'?{type:'kitsnode.proof.prepare.v2',...fields}:{type:'kitsnode.proof.get.v2',nonce});
  }
  const r=ready?.request,k=r?.publicKey;
  if(signal.aborted||ready?.status!=='ready'||!r||Object.keys(r).sort().join(',')!=='accountId,autoPolicy,consentDigest,consentId,consentVersion,naverPolicyDigest,naverPolicyVersion,publicKey,recipientId,requestId,role,viewerId'||!uuid4(r.requestId)||r.consentId!==consentId||r.accountId!==accountId||r.consentVersion!==consentVersion||r.consentDigest!==`sha256:${policyDigest}`||r.naverPolicyVersion!==NAVER_INVITE_POLICY_VERSION||r.naverPolicyDigest!==`sha256:${NAVER_INVITE_POLICY_DIGEST}`||r.recipientId!=='kitsnode'||r.role!=='OPERATIONS_VIEWER'||r.autoPolicy!==true||!viewer(r.viewerId)||!k||k.kty!=='EC'||k.crv!=='P-256'||k.d!==undefined||!/^[A-Za-z0-9_-]{43}$/.test(k.x||'')||!/^[A-Za-z0-9_-]{43}$/.test(k.y||''))return {status:'blocked'};
  const token=await current();if(!token||token!==originalToken)return {status:'blocked'};
  const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({consentId,request:r}),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok||signal.aborted||isCurrent(userId)!==true)return {status:'blocked'};
  const result=await response.json();if(result?.status!=='approved'||!await sameSession())return {status:'blocked'};
  const wake=await runtime.sendMessage(extension,{type:'kitsnode.proof.approved.v2',nonce,requestId:r.requestId});
  return !signal.aborted&&isCurrent(userId)===true&&wake?.status==='signalled'?{status:'approved'}:{status:'blocked'};
 }catch{return {status:'blocked'};}
}
