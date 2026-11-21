import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';

// Transport only: credentials and customer ID must come from a separately
// authorized server-side binding. It cannot establish advertiser ownership.
const secret=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&/^[\x21-\x7e]+$/.test(v);
const numeric=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v));
const id=v=>typeof v==='string'&&/^(?:cmp|grp|nad|nkw)-[A-Za-z0-9-]{1,100}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const metric=v=>v===undefined||v===null?null:typeof v==='number'&&Number.isFinite(v)&&v>=0?v:NaN;
const integer=v=>v===null||(Number.isSafeInteger(v)&&v>=0);
const unavailable=reason=>({status:'unavailable',reason});
const timestampMetadata=v=>typeof v==='string'&&/^\d{12}$/.test(v)?v:null;

export function createNaverPerformanceReader({apiKey,secretKey,customerId,fetcher=fetch,now=Date.now}={}) {
 if(!secret(apiKey)||!secret(secretKey)||!numeric(customerId)||typeof fetcher!=='function'||typeof now!=='function')throw TypeError('invalid_configuration');
 return Object.freeze({async read({targetId,since,until}={}) {
  if(!id(targetId)||!date(since)||!date(until)||since>until||Date.parse(until)-Date.parse(since)>30*86400000)return unavailable('invalid_input');
  const time=now();if(!Number.isSafeInteger(time)||time<0)return unavailable('invalid_clock');
  const path='/stats',url=new URL(path,'https://api.searchad.naver.com');
  url.searchParams.set('ids',targetId);
  url.searchParams.set('fields',JSON.stringify(['impCnt','clkCnt','salesAmt','ctr','cpc']));
  url.searchParams.set('timeRange',JSON.stringify({since,until}));
  const signature=createHmac('sha256',secretKey).update(`${time}.GET.${path}`).digest('base64');
  let response;try{response=await fetcher(url,{method:'GET',headers:{'X-Timestamp':String(time),'X-API-KEY':apiKey,'X-Customer':String(customerId),'X-Signature':signature},signal:AbortSignal.timeout(8000),redirect:'error'});}catch{return unavailable('network_error')}
  if(!response?.ok)return unavailable(response?.status===401||response?.status===403?'access_denied':response?.status===429?'rate_limited':'upstream_error');
  let body;try{body=await readLimitedJson(response,2000000)}catch{return unavailable('invalid_response')}
  const observed=now();if(!Number.isSafeInteger(observed)||observed<time||!Number.isFinite(new Date(observed).getTime()))return unavailable('invalid_clock');
  if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.data)||body.data.length>1)return unavailable('invalid_response');
  const base={targetId,period:{since,until},observedAt:new Date(observed).toISOString(),sourceTimes:{compTm:timestampMetadata(body.compTm),cycleBaseTm:timestampMetadata(body.cycleBaseTm)},source:'naver_stats'};
  if(!body.data.length)return {...base,status:'no_data',reason:'empty_response'};
  const row=body.data[0];if(!row||typeof row!=='object'||Array.isArray(row)||row.id!==targetId)return unavailable('invalid_response');
  const impressions=metric(row.impCnt),clicks=metric(row.clkCnt),cost=metric(row.salesAmt),clickThroughRate=metric(row.ctr),averageClickCost=metric(row.cpc);
  if(![impressions,clicks].every(integer)||![cost,clickThroughRate,averageClickCost].every(v=>v===null||Number.isFinite(v))||[impressions,clicks,cost,clickThroughRate,averageClickCost].every(v=>v===null))return unavailable('invalid_response');
  return {...base,status:'observed',metrics:{impressions,clicks,cost,clickThroughRate,averageClickCost}};
 }});
}
