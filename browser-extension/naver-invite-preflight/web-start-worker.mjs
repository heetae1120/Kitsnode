import {openAdvertiserLogin,routeSelectedAdvertiserTab,bindSelectedAccount} from './web-start-bridge.mjs';
import {openInviteDialog} from './preflight.mjs';

export async function advanceAdvertiserTab(chromeApi, tabId) {
  const routed=await routeSelectedAdvertiserTab({chromeApi,tabId});
  if(routed.status==='routing') return routed;
  try {
    const tab=await chromeApi.tabs.get(tabId), u=new URL(tab.url);
    if(u.origin!=='https://ads.naver.com'||u.search||u.hash) return {status:'ignored'};
    const match=u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
    if(!match)return {status:'ignored'};
    const records=await chromeApi.storage.session.get(null);
    const pending=Object.entries(records).filter(([key,r])=>key.startsWith('web_start_')&&r?.state==='account_routing'&&r.naverTabId===tabId&&r.accountId===match[1]);
    if(pending.length!==1)return {status:'blocked'};
    const nonce=pending[0][0].slice('web_start_'.length);
    if((await bindSelectedAccount({chromeApi,nonce,tabId,accountId:match[1]})).status!=='account_selected')return {status:'blocked'};
    const result=await chromeApi.scripting.executeScript({target:{tabId},func:openInviteDialog});
    // This prepares only the visible dialog. An opened dialog does not itself
    // authenticate an advertiser or authorize sending any invitation.
    return result?.length===1&&result[0]?.result==='dialog_requested'?{status:'policy_screen_requested'}:{status:'unverified'};
  } catch { return {status:'unavailable'}; }
}

// This listener only opens a fixed Naver page. It cannot issue invitations,
// authenticate users or accept credentials from websites.
const registered = new WeakSet();
export function registerWebStartWorker(chromeApi) {
  if (registered.has(chromeApi)) return;
  registered.add(chromeApi);
  const pendingTabs=new Set();
  chromeApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    const tabId=sender?.tab?.id;
    if(!Number.isInteger(tabId)||pendingTabs.has(tabId)){sendResponse({status:'blocked'});return false;}
    pendingTabs.add(tabId);
    void openAdvertiserLogin({chromeApi, message, sender}).then(sendResponse, () => sendResponse({status:'unavailable'})).finally(()=>pendingTabs.delete(tabId));
    return true;
  });
  chromeApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if(changeInfo.status==='complete') void advanceAdvertiserTab(chromeApi,tabId);
  });
}
if (globalThis.chrome?.runtime?.onMessageExternal) registerWebStartWorker(globalThis.chrome);
