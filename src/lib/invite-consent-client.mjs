// Candidate route; the fixed destination must authenticate and authorize the user.
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-api/invite-consents';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s);
export function createInviteConsentClient({enabled,version,policyDigest,policyUrl,fetcher=globalThis.fetch}={}){
 let url;try{url=new URL(policyUrl);}catch{return undefined;}
 if(enabled!==true||!/^[-A-Za-z0-9._]{1,64}$/.test(version||'')||!/^[0-9a-f]{64}$/.test(policyDigest||'')||url.protocol!=='https:'||url.hostname!=='ads.naver.com'||url.username||url.password||typeof fetcher!=='function')return undefined;
 return Object.freeze({policyUrl:url.href,async record(token,accountId,signal){
  if(typeof token!=='string'||!/^[A-Za-z0-9._-]{1,8192}$/.test(token)||!/^[1-9][0-9]{0,15}$/.test(accountId)||!signal||signal.aborted)throw Error('invalid_request');
  const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({accountId,accepted:true,version,policyDigest}),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('unavailable');const data=await response.json();if(signal.aborted||data?.status!=='recorded'||!uuid(data?.consentId))throw Error('invalid_response');return {status:'recorded'};
 }});
}
