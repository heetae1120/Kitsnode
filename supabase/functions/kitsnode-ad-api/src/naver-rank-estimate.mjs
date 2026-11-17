import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';

const validId=(v,prefix)=>typeof v==='string'&&new RegExp(`^${prefix}-[A-Za-z0-9-]{1,100}$`).test(v);
const account=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v))?String(v):null;
const validBid=v=>Number.isSafeInteger(v)&&v>=50&&v<=100000&&v%10===0;
const fail=reason=>({ok:false,reason,execution:'disabled'});

/**
 * Server-only read-only estimate transport. A caller must authenticate the
 * user, obtain their approved customer binding server-side, and validate the
 * target's ownership before using this function. A Naver estimate is neither
 * an observed rank nor a guarantee. No bid mutation path is provided.
 */
export function createNaverRankEstimate({apiKey,secretKey,customerId,fetcher=fetch,now=Date.now}={}) {
 const c=account(customerId);
 if(!c||![apiKey,secretKey].every(v=>typeof v==='string'&&/^[\x21-\x7e]+$/.test(v))||typeof fetcher!=='function'||typeof now!=='function')throw TypeError('invalid_configuration');
 return async function estimate({kind,targetId,device,position}={}){
  // Shopping NPLA currently permits only 1–4 based on observed provider
  // responses; do not assume the broader keyword range applies to products.
  const maxPosition=kind==='product'?4:device==='PC'?10:5;
  if(!['keyword','product'].includes(kind)||!validId(targetId,kind==='keyword'?'nkw':'nad')||!['PC','MOBILE'].includes(device)||!Number.isSafeInteger(position)||position<1||position>maxPosition)return fail('invalid_input');
  const path=kind==='keyword'?'/estimate/average-position-bid/id':'/npla-estimate/average-position-bid/id';
  const timestamp=now();if(!Number.isSafeInteger(timestamp)||timestamp<=0)return fail('invalid_clock');
  const signature=createHmac('sha256',secretKey).update(`${timestamp}.POST.${path}`).digest('base64');
  let response;
  try{response=await fetcher(new URL(path,'https://api.searchad.naver.com'),{method:'POST',headers:{'Content-Type':'application/json','X-Timestamp':String(timestamp),'X-API-KEY':apiKey,'X-Customer':c,'X-Signature':signature},body:JSON.stringify({device,items:[{key:targetId,position}]}),signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});}catch{return fail('network_error');}
  if(!response.ok)return fail(response.status===401||response.status===403?'access_denied':response.status===429?'rate_limited':'upstream_error');
  let payload;try{payload=await readLimitedJson(response,2_000_000)}catch{return fail('invalid_response')}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return fail('invalid_response');
  if(payload.device!==undefined&&payload.device!==device)return fail('device_mismatch');
  let rows;
  if(kind==='keyword'){
   if(payload.device!==device||!Array.isArray(payload.estimate))return fail('invalid_response');rows=payload.estimate;
  }else if(Array.isArray(payload.items))rows=payload.items;
  else if(Array.isArray(payload.estimate))rows=payload.estimate;
  else if(Object.hasOwn(payload,'nccAdId')||Object.hasOwn(payload,'key'))rows=[payload];
  else return fail('invalid_response');
  if(rows.length>200||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))return fail('invalid_response');
  // Reject inconsistent aliases and row-level device when present. An omitted
  // device is only associated with this isolated request, not provider proof.
  const ids=kind==='keyword'?['nccKeywordId','key']:['nccAdId','key'];
  const selected=[];
  for(const row of rows){
   const present=ids.filter(k=>row[k]!==undefined).map(k=>row[k]);
   if(present.some(v=>typeof v!=='string')||new Set(present).size>1)return fail('invalid_response');
   if(present[0]!==targetId||row.position!==position)continue;
   if(row.device!==undefined&&row.device!==device)return fail('device_mismatch');
   selected.push(row);
  }
  if(selected.length===0)return fail('estimate_unavailable');
  if(selected.length!==1)return fail('invalid_response');
  const value=selected[0].bid;
  if(value===null||value===undefined||value===0)return fail('estimate_unavailable');
  if(!validBid(value))return fail('invalid_response');
  return {ok:true,kind,targetId,device,position,bid:value,fetchedAt:timestamp,deviceEchoed:payload.device===device||selected[0].device===device,execution:'disabled'};
 };
}
