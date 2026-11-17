import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';

// Server-only, read-only adapter. It is intentionally not exposed as a route.
// A successful API call proves the API principal has access, not that a
// particular KITSNODE user owns the supplied ad account.
export function createNaverAdReader({apiKey, secretKey, customerId, fetcher=fetch, now=Date.now}) {
  if (![apiKey,secretKey].every(v => typeof v === 'string' && /^[\x21-\x7e]+$/.test(v)) || !/^[1-9][0-9]{0,15}$/.test(String(customerId))) throw new Error('invalid_configuration');
  const call = async (path, params = {}, byteLimit = 2_000_000) => {
    const url = new URL(path, 'https://api.searchad.naver.com');
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
    const time = String(now());
    const signature = createHmac('sha256',secretKey).update(`${time}.GET.${path}`).digest('base64');
    let response;
    try { response = await fetcher(url,{method:'GET',headers:{'X-Timestamp':time,'X-API-KEY':apiKey,'X-Customer':String(customerId),'X-Signature':signature},signal:AbortSignal.timeout(8000),redirect:'error'}); }
    catch { return {ok:false,code:'network_error'}; }
    if (!response.ok) return {ok:false,code:response.status===401||response.status===403?'access_denied':response.status===429?'rate_limited':'upstream_error'};
    try {
      const data = await readLimitedJson(response,byteLimit);
      if (!Array.isArray(data) || data.length > 10000) return {ok:false,code:'invalid_response'};
      return {ok:true, data};
    } catch { return {ok:false,code:'invalid_response'}; }
  };
  return Object.freeze({
    campaigns: () => call('/ncc/campaigns'),
    adgroups: campaignId => /^cmp-[A-Za-z0-9-]{1,100}$/.test(campaignId) ? call('/ncc/adgroups',{nccCampaignId:campaignId}) : Promise.resolve({ok:false,code:'invalid_target'}),
    keywords: groupId => /^grp-[A-Za-z0-9-]{1,100}$/.test(groupId) ? call('/ncc/keywords',{nccAdgroupId:groupId}) : Promise.resolve({ok:false,code:'invalid_target'}),
    // This list is not declared complete: provider pagination/limits must be
    // independently verified before it can determine group-wide impact.
    shoppingAds: groupId => /^grp-[A-Za-z0-9-]{1,100}$/.test(groupId) ? call('/ncc/ads',{nccAdgroupId:groupId},8_000_000) : Promise.resolve({ok:false,code:'invalid_target'}),
  });
}
