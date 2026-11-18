// Server-only candidate. Not mounted as an API and not backed by a production
// repository. authorizeAdvertiser must establish an independently trustworthy
// member-to-advertiser relationship; a browser-reported ID is not proof.
import { randomBytes, createHash } from 'node:crypto';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const account=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');

export function createInviteGrantService({auth,requests,repository,authorizeAdvertiser,now=Date.now,makeSecret=()=>randomBytes(32).toString('base64url')}={}) {
 if(![auth?.verify,requests?.get,repository?.insert,repository?.consume,authorizeAdvertiser,now,makeSecret].every(f=>typeof f==='function'))throw TypeError('invalid_configuration');
 const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.sort().join(',');
 async function issue(input) {
  if(!exact(input,['token','requestId','nonce','accountId','viewerId']) || typeof input.token!=='string'||!input.token||!uuid(input.requestId)||!uuid(input.nonce)||!account(input.accountId)||!id(input.viewerId)||input.viewerId==='kitsnode')return {status:'blocked'};
  try {
   const session=await auth.verify(input.token);
   if(!session||!uuid(session.userId)||!uuid(session.sessionId))return {status:'blocked'};
   const req=await requests.get(input.requestId);
   if(!req||req.requestId!==input.requestId||req.userId!==session.userId||req.accountId!==input.accountId||req.status!=='pending_review'||req.consent!==true||!Number.isSafeInteger(req.revision)||req.revision<0)return {status:'blocked'};
   const binding={requestId:req.requestId,userId:session.userId,sessionId:session.sessionId,nonce:input.nonce,accountId:req.accountId,viewerId:input.viewerId,revision:req.revision,recipientId:'kitsnode',role:'OPERATIONS_MANAGER'};
   if(await authorizeAdvertiser(binding)!==true)return {status:'blocked'};
   const current=await auth.verify(input.token), latest=await requests.get(input.requestId);
   if(!current||current.userId!==session.userId||current.sessionId!==session.sessionId||!latest||latest.requestId!==req.requestId||latest.userId!==req.userId||latest.accountId!==req.accountId||latest.status!=='pending_review'||latest.consent!==true||latest.revision!==req.revision)return {status:'blocked'};
   const secret=makeSecret(),time=now();
   if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(secret)||!Number.isSafeInteger(time)||time<0)return {status:'blocked'};
   // insert must atomically recheck the request, current consent and live
   // session, and reject concurrent/replayed issuances for the same request.
   if(await repository.insert({...binding,secretHash:hash(secret),expiresAt:time+120000})!==true)return {status:'blocked'};
   return {status:'issued',grant:secret,expiresAt:time+120000};
  }catch{return {status:'blocked'};}
 }
 async function consume(input) {
  if(!exact(input,['grant','nonce','accountId','viewerId','recipientId','role'])||typeof input.grant!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(input.grant)||!uuid(input.nonce)||!account(input.accountId)||!id(input.viewerId)||input.recipientId!=='kitsnode'||input.role!=='OPERATIONS_MANAGER')return {status:'blocked'};
  try {
   const time=now(); if(!Number.isSafeInteger(time)||time<0)return {status:'blocked'};
   // This operation must consume atomically while rechecking expiry, consent,
   // request revision, account, recipient, viewer and still-live session.
   const row=await repository.consume({secretHash:hash(input.grant),nonce:input.nonce,accountId:input.accountId,viewerId:input.viewerId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER',now:time});
   if(!row||row.nonce!==input.nonce||row.accountId!==input.accountId||row.viewerId!==input.viewerId||row.recipientId!=='kitsnode'||row.role!=='OPERATIONS_MANAGER'||!uuid(row.userId)||!uuid(row.requestId))return {status:'blocked'};
   return {approved:true,nonce:row.nonce,accountId:row.accountId,viewerId:row.viewerId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER',userId:row.userId,requestId:row.requestId};
  }catch{return {status:'blocked'};}
 }
 return Object.freeze({issue,consume});
}
