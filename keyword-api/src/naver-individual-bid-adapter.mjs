import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';
import {classifyIndividualBidWriteOutcome} from './individual-bid-safety.mjs';

const id=(value,prefix)=>typeof value==='string'&&new RegExp(`^${prefix}-[A-Za-z0-9-]{1,100}$`).test(value);
const bid=(n,kind)=>Number.isSafeInteger(n)&&n>=(kind==='keyword'?70:50)&&n<=100000&&n%10===0;
const customer=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v))?String(v):null;

// Low-level server transport only; no HTTP route, scheduler, user authorization,
// persistence or production configuration imports it. The default is disabled.
// This provider does not expose a verified atomic condition: do not wire this
// transport to automatic execution. The caller must authorize and audit any
// future manual use, bind credentials and account, and handle uncertain writes.
export function createNaverIndividualBidAdapter({apiKey,secretKey,customerId,writeEnabled=false,fetcher=fetch,now=Date.now}={}) {
 const account=customer(customerId);
 if(!account||![apiKey,secretKey].every(v=>typeof v==='string'&&/^[\x21-\x7e]+$/.test(v))||typeof fetcher!=='function'||typeof now!=='function')throw Error('invalid_configuration');
 async function request(method,path,{query,body}={}) {
  const timestamp=String(now()),url=new URL(path,'https://api.searchad.naver.com');
  if(query)for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
  const signature=createHmac('sha256',secretKey).update(`${timestamp}.${method}.${path}`).digest('base64');
  let response;
  try{response=await fetcher(url,{method,headers:{'X-Timestamp':timestamp,'X-API-KEY':apiKey,'X-Customer':account,'X-Signature':signature,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});}catch{return {state:method==='PUT'?'unconfirmed':'read_failed'}}
  if(!response.ok)return {state:method==='PUT'?'unconfirmed':'read_failed'};
  try{return {state:'accepted',data:await readLimitedJson(response,2_000_000)}}catch{return {state:method==='PUT'?'unconfirmed':'read_failed'}}
 }
 async function read({kind,targetId,groupId}) {
  if(!['product','keyword'].includes(kind)||!id(targetId,kind==='product'?'nad':'nkw')||!id(groupId,'grp'))return null;
  const path=kind==='product'?`/ncc/ads/${targetId}`:`/ncc/keywords/${targetId}`;
  const r=await request('GET',path);if(r.state!=='accepted')return null;
  const x=r.data,attr=kind==='product'?x?.adAttr:x;
  if(!x||typeof x!=='object'||Array.isArray(x)||customer(x.customerId)!==account||x.nccAdgroupId!==groupId||(kind==='product'?(x.nccAdId!==targetId||x.type!=='SHOPPING_PRODUCT_AD'):x.nccKeywordId!==targetId)||typeof attr?.useGroupBidAmt!=='boolean'||!(attr.bidAmt===null||bid(attr.bidAmt,kind)))return null;
  return {kind,targetId,groupId,useGroupBid:attr.useGroupBidAmt,bid:attr.bidAmt,raw:x};
 }
 return Object.freeze({
  // No HTTP success is treated as proof without a separate provider read.
  async changeAndVerify({kind,targetId,groupId,desiredBid,expectedBid,expectedUseGroupBid,allowGroupConversion=false}={}) {
   if(writeEnabled!==true)return {status:'blocked',reason:'write_disabled',retry:'disabled'};
   if(!['product','keyword'].includes(kind)||!id(targetId,kind==='product'?'nad':'nkw')||!id(groupId,'grp')||!bid(desiredBid,kind)||typeof expectedUseGroupBid!=='boolean'||!(expectedBid===null||bid(expectedBid,kind)))return {status:'blocked',reason:'invalid_input',retry:'disabled'};
   if(expectedUseGroupBid&&allowGroupConversion!==true)return {status:'blocked',reason:'conversion_not_authorized',retry:'disabled'};
   const before=await read({kind,targetId,groupId});
   if(!before)return {status:'blocked',reason:'read_unavailable',retry:'disabled'};
   if(before.bid!==expectedBid||before.useGroupBid!==expectedUseGroupBid)return {status:'blocked',reason:'state_changed',retry:'disabled'};
   const path=kind==='product'?`/ncc/ads/${targetId}`:'/ncc/keywords';
   const body=kind==='product'?{nccAdId:targetId,type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:desiredBid,useGroupBidAmt:false}}:[{...before.raw,bidAmt:desiredBid,useGroupBidAmt:false}];
   const sent=await request('PUT',path,{query:{fields:kind==='product'?'adAttr':'bidAmt'},body});
   const after=await read({kind,targetId,groupId});
   const outcome=classifyIndividualBidWriteOutcome({requestState:sent.state,expected:{kind,targetId,groupId,bid:desiredBid},observed:after});
   return {...outcome,observedBid:after?.bid??null,observedUseGroupBid:after?.useGroupBid??null};
  }
 });
}
