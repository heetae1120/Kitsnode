import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const id=x=>typeof x==='string'&&/^(?:nad|nkw)-[A-Za-z0-9-]{1,100}$/.test(x);
const validNumber=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
// Candidate transport only. No route, authentication binding, scheduler or storage.
// API response format and availability must be verified against the real account.
export function createHourlyPerformanceCandidate({apiKey,secretKey,customerId,fetcher=fetch,now=Date.now}={}) {
 if(![apiKey,secretKey].every(x=>typeof x==='string'&&x.length>0&&x.length<=8192&&/^[\x21-\x7e]+$/.test(x))||!/^\d{1,16}$/.test(String(customerId))||typeof fetcher!=='function'||typeof now!=='function')throw Error('invalid_configuration');
 return Object.freeze({async read({targetId,day}={}){
  if(!id(targetId)||!date(day))return {status:'unavailable',reason:'invalid_input'};
  const time=now();if(!Number.isSafeInteger(time)||time<0)return {status:'unavailable',reason:'invalid_clock'};
  const path='/stats',url=new URL(path,'https://api.searchad.naver.com');
  url.searchParams.set('ids',targetId);url.searchParams.set('fields',JSON.stringify(['impCnt','clkCnt','salesAmt','cpc','purchaseCcnt','purchaseConvAmt']));
  url.searchParams.set('timeRange',JSON.stringify({since:day,until:day}));url.searchParams.set('timeIncrement','allDays');url.searchParams.set('breakdown','hh24');
  const signature=createHmac('sha256',secretKey).update(`${time}.GET.${path}`).digest('base64');let response;
  try{response=await fetcher(url,{method:'GET',headers:{'X-Timestamp':String(time),'X-API-KEY':apiKey,'X-Customer':String(customerId),'X-Signature':signature},signal:AbortSignal.timeout(8000),redirect:'error'});}catch{return {status:'unavailable',reason:'network_error'}}
  if(!response?.ok)return {status:'unavailable',reason:response?.status===401||response?.status===403?'access_denied':response?.status===429?'rate_limited':'upstream_error'};
  let body;try{body=await readLimitedJson(response,2_000_000)}catch{return {status:'unavailable',reason:'invalid_response'}}
  if(!Array.isArray(body?.data)||body.data.length>1)return {status:'unavailable',reason:'invalid_response'};
  if(body.data.length===0)return {status:'no_data',targetId,day};
  const record=body.data[0];if(record?.id!==targetId||!Array.isArray(record.breakdowns)||record.breakdowns.length>24)return {status:'unavailable',reason:'invalid_response'};
  const hours=[];for(const row of record.breakdowns){
   const label=typeof row?.name==='string'?row.name.trim():'';const match=label.match(/^(\d{1,2})시\s*~\s*(\d{1,2})시$/);const h=/^(?:[01]?\d|2[0-3])$/.test(label)?Number(label):match&&Number(match[1])<=23&&Number(match[2])===Number(match[1])+1?Number(match[1]):null;
   if(h===null||hours.some(x=>x.hour===h))return {status:'unavailable',reason:'invalid_response'};
   const val=k=>row[k]===undefined||row[k]===null?null:validNumber(row[k])?row[k]:NaN;
   const impressions=val('impCnt'),clicks=val('clkCnt'),cost=val('salesAmt'),purchases=val('purchaseCcnt'),revenue=val('purchaseConvAmt');
   if(![impressions,clicks,purchases].every(x=>x===null||Number.isSafeInteger(x))||![cost,revenue].every(x=>x===null||validNumber(x)))return {status:'unavailable',reason:'invalid_response'};
   hours.push({hour:h,impressions,clicks,cost,purchases,revenue,averageCpc:clicks>0&&cost!==null?cost/clicks:null});
  }
  return {status:'observed',targetId,day,source:'naver_stats',hours:hours.sort((a,b)=>a.hour-b.hour),compTm:typeof body.compTm==='string'?body.compTm:null,cycleBaseTm:typeof body.cycleBaseTm==='string'?body.cycleBaseTm:null};
 }});
}
