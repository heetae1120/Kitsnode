// Candidate composition. The caller must supply an independently trusted,
// atomic server grant verifier; a web checkbox or storage value is not one.
// No runtime listener is registered until a real verifier is available.
import {createWebAutomationGate} from './web-automation-gate.mjs';

export function createWebApprovedLaunch({chromeApi,locks,verifyAndConsume,observeViewer,readBound,now=Date.now}={}) {
 if(!chromeApi?.storage?.session || !chromeApi?.tabs?.create || !chromeApi?.runtime?.getURL ||
    !locks?.request || typeof verifyAndConsume!=='function' || typeof observeViewer!=='function' || typeof now!=='function') throw TypeError('invalid_configuration');
 const run=async({tabId,accountId,viewerId})=>{
  const nonce=crypto.randomUUID();
  const key='automatic_start_'+nonce;
  const binding={tabId,accountId,viewerId,approved:true,createdAt:now()};
  await chromeApi.storage.session.set({[key]:binding});
  try {
   await chromeApi.tabs.create({url:chromeApi.runtime.getURL(`automatic-controller.html#${nonce}`),active:false});
   return {status:'controller_started'};
  } catch {
   try {await chromeApi.storage.session.remove(key)} catch {}
   throw Error('controller_unavailable');
  }
 };
 const gate=createWebAutomationGate({chromeApi,verifyAndConsume,observeViewer,run,...(readBound?{readBound}:{})});
 return async function begin({nonce,grant}={}) {
  if(typeof nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce))return {status:'blocked'};
  try {
   return await locks.request('web_launch_'+nonce,{ifAvailable:true},async lock=>lock ? gate({nonce,grant}) : {status:'blocked'});
  } catch {return {status:'blocked'};}
 };
}
