import {NAVER_INVITE_POLICY_DIGEST,NAVER_INVITE_POLICY_VERSION} from './naver-invite-policy.mjs';
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/policy-confirm';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
/** The server independently binds this confirmation to the current consent and session. */
export async function confirmNaverInvitePolicy({token,consentId,signal,fetcher=globalThis.fetch}={}){
 if(typeof token!=='string'||!/^[A-Za-z0-9._-]{1,8192}$/.test(token)||!uuid(consentId)||!signal||signal.aborted||typeof fetcher!=='function')return false;
 try{
  const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({consentId,naverPolicyVersion:NAVER_INVITE_POLICY_VERSION,naverPolicyDigest:`sha256:${NAVER_INVITE_POLICY_DIGEST}`}),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok||signal.aborted)return false;
  const body=await response.json();return !signal.aborted&&body?.status==='confirmed';
 }catch{return false;}
}
