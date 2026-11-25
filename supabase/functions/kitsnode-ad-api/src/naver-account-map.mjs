import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';
const numeric = value => typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value);

/** Resolve a Naver Ads account number to its SearchAd customer ID.
 * Read access demonstrates Naver API access, not ownership by a KITSNODE user.
 * No route should expose the result without an independently approved binding.
 */
export function createAccountResolver({apiKey, secretKey, principalCustomerId, fetcher=fetch, now=Date.now}) {
  if (![apiKey,secretKey].every(v=>typeof v==='string' && /^[\x21-\x7e]+$/.test(v)) || !numeric(principalCustomerId)) throw new Error('invalid_configuration');
  return async function resolve(adAccountId) {
    if (!numeric(adAccountId)) return {ok:false,code:'invalid_target'};
    const path='/ad-accounts';
    for(let page=0;page<10;page++) {
      const time=String(now()), url=new URL(path,'https://api.searchad.naver.com');
      url.searchParams.set('page',String(page)); url.searchParams.set('size','100');
      const signature=createHmac('sha256',secretKey).update(`${time}.GET.${path}`).digest('base64');
      let response;
      try {response=await fetcher(url,{method:'GET',headers:{'X-Timestamp':time,'X-API-KEY':apiKey,'X-Customer':principalCustomerId,'X-Signature':signature},signal:AbortSignal.timeout(8000),redirect:'error'});}
      catch {return {ok:false,code:'network_error'};}
      if(!response.ok) return {ok:false,code:response.status===401||response.status===403?'access_denied':response.status===429?'rate_limited':'upstream_error'};
      let data;
      try {data=await readLimitedJson(response);} catch{return {ok:false,code:'invalid_response'};}
      if(!data || !Array.isArray(data.content) || data.content.length>100 || typeof data.last!=='boolean') return {ok:false,code:'invalid_response'};
      const matches=data.content.filter(row=>String(row?.adAccountNo)===adAccountId);
      if(matches.length>1) return {ok:false,code:'ambiguous_response'};
      if(matches.length===1) {
        const match=matches[0], customerId=String(match.adAccount?.masterCustomerId ?? '');
        if(!numeric(customerId) || !['OWNER','MASTER','READ_ONLY'].includes(match.roleName)) return {ok:false,code:'invalid_response'};
        return {ok:true,adAccountId,customerId,role:match.roleName};
      }
      if(data.last) return {ok:false,code:'not_accessible'};
    }
    return {ok:false,code:'pagination_limit'};
  };
}
