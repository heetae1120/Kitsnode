// Unwired test candidate. `verifyAndConsume` MUST be an independently trusted
// server verifier with a one-time, account-specific approval, not a value from
// web JavaScript or a mock. No such verifier is implemented or deployed yet.
import {getBoundAdvertiserTab} from './web-start-bridge.mjs';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);

export function createWebAutomationGate({chromeApi,verifyAndConsume,observeViewer,run,readBound=getBoundAdvertiserTab}={}) {
 if(!chromeApi || ![verifyAndConsume,observeViewer,run,readBound].every(x=>typeof x==='function'))throw TypeError('invalid_configuration');
 return async function begin({nonce,grant}={}) {
  if(typeof grant!=='string'||grant.length<16||grant.length>4096)return {status:'blocked'};
  let started=false;
  try {
   const before=await readBound({chromeApi,nonce});
   if(before?.status!=='bound')return {status:'blocked'};
   const viewerId=await observeViewer({chromeApi,tabId:before.tabId,accountId:before.accountId});
   if(!id(viewerId)||viewerId==='kitsnode')return {status:'blocked'};
   // This dependency must atomically verify and consume a trusted server grant
   // bound to the authenticated member, exact request, account and recipient.
   const verified=await verifyAndConsume({grant,nonce,accountId:before.accountId,viewerId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER'});
   if(verified?.approved!==true || verified.nonce!==nonce || verified.accountId!==before.accountId || verified.viewerId!==viewerId || verified.recipientId!=='kitsnode' || verified.role!=='OPERATIONS_MANAGER' || typeof verified.userId!=='string' || !verified.userId || typeof verified.requestId!=='string' || !verified.requestId)return {status:'blocked'};
   const after=await readBound({chromeApi,nonce});
   if(after?.status!=='bound'||after.tabId!==before.tabId||after.accountId!==before.accountId || await observeViewer({chromeApi,tabId:before.tabId,accountId:before.accountId})!==viewerId)return {status:'blocked'};
   started=true;
   return await run({tabId:before.tabId,accountId:before.accountId,viewerId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER',userId:verified.userId,requestId:verified.requestId});
  } catch {return started?{status:'uncertain',retry:'disabled'}:{status:'blocked'};}
 };
}
