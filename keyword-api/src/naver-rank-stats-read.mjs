import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';

// Server-only transport. The caller MUST separately authenticate the user and
// authorize the customer, target ownership and consent; this adapter performs
// no access control and must not be exposed as a route on its own.
const validSecret=x=>typeof x==='string'&&x.length>0&&x.length<=8192&&/^[\x21-\x7e]+$/.test(x);
const customer=x=>(typeof x==='string'||Number.isSafeInteger(x))&&/^[1-9][0-9]{0,15}$/.test(String(x))?String(x):null;
const validId=x=>typeof x==='string'&&/^(?:cmp|grp|nad|nkw)-[A-Za-z0-9-]{1,100}$/.test(x);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const metadata=x=>typeof x==='string'&&/^\d{12}$/.test(x)?x:null;
const positiveRank=x=>typeof x==='number'&&Number.isFinite(x)&&x>=1&&x<=1000?x:null;
const unavailable=reason=>({status:'unavailable',reason});

// pcNxAvgRnk and mblNxAvgRnk are statistics for integrated-search placements,
// not live rank, and cannot be attributed to a specific bid-change interval.
// A single entity is queried to avoid mixing different IDs/campaign types.
export function createNaverRankStatsReader({apiKey,secretKey,customerId,fetcher=fetch,now=Date.now}={}){
 const account=customer(customerId);
 if(!account||![apiKey,secretKey].every(validSecret)||typeof fetcher!=='function'||typeof now!=='function')throw TypeError('invalid_configuration');
 return Object.freeze({async read({targetId,since,until}={}){
  if(!validId(targetId)||!validDate(since)||!validDate(until))return unavailable('invalid_input');
  const start=Date.parse(since+'T00:00:00Z'),end=Date.parse(until+'T00:00:00Z');
  if(start>end||end-start>30*86400000)return unavailable('invalid_input');
  const timestamp=now();if(!Number.isSafeInteger(timestamp)||timestamp<0)return unavailable('invalid_clock');
  const path='/stats',url=new URL(path,'https://api.searchad.naver.com');
  url.searchParams.set('ids',targetId);
  url.searchParams.set('fields',JSON.stringify(['impCnt','avgRnk','pcNxAvgRnk','mblNxAvgRnk']));
  url.searchParams.set('timeRange',JSON.stringify({since,until}));
  const signature=createHmac('sha256',secretKey).update(`${timestamp}.GET.${path}`).digest('base64');
  let response;
  try{response=await fetcher(url,{method:'GET',headers:{'X-Timestamp':String(timestamp),'X-API-KEY':apiKey,'X-Customer':account,'X-Signature':signature},signal:AbortSignal.timeout(8000),redirect:'error'});}catch{return unavailable('network_error')}
  if(!response?.ok)return unavailable(response?.status===401||response?.status===403?'access_denied':response?.status===429?'rate_limited':'upstream_error');
  let body;try{body=await readLimitedJson(response,2000000)}catch{return unavailable('invalid_response')}
  const observedAt=now();if(!Number.isSafeInteger(observedAt)||observedAt<timestamp||!Number.isFinite(new Date(observedAt).getTime()))return unavailable('invalid_clock');
  if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.data)||body.data.length>1)return unavailable('invalid_response');
  const base={targetId,period:{since,until},observedAt:new Date(observedAt).toISOString(),sourceTimes:{compTm:metadata(body.compTm),cycleBaseTm:metadata(body.cycleBaseTm)},deviceMetricScope:'integrated_search_average',overallMetricScope:'provider_average_rank',source:'naver_stats'};
  if(body.data.length===0)return {...base,status:'no_data',reason:'empty_response'};
  const row=body.data[0];
  if(!row||typeof row!=='object'||Array.isArray(row)||row.id!==targetId||!Number.isSafeInteger(row.impCnt)||row.impCnt<0)return unavailable('invalid_response');
  if(row.impCnt===0)return {...base,status:'no_data',reason:'no_impressions',impressions:0};
  const pc=positiveRank(row.pcNxAvgRnk),mobile=positiveRank(row.mblNxAvgRnk),overall=positiveRank(row.avgRnk);
  // Do not guess device from pcMblTp or interpret zero/missing ranks as rank 0.
  if(pc===null&&mobile===null&&overall===null)return {...base,status:'no_data',reason:'rank_unavailable',impressions:row.impCnt};
  return {...base,status:'observed',impressions:row.impCnt,overallAverageRank:overall,pcIntegratedSearchAverageRank:pc,mobileIntegratedSearchAverageRank:mobile};
 }});
}
