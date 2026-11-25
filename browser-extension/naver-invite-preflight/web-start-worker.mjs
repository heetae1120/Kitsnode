import {openAdvertiserLogin,routeSelectedAdvertiserTab,bindSelectedAccount,getBoundAdvertiserTab} from './web-start-bridge.mjs';
import {captureAdvertiser,startAutomaticInvite} from './automatic-start.mjs';
import {accountDiscovery} from './account-discovery.mjs';
import {candidateWebMessageV2} from './consent-message-v2-candidate.mjs';

// Executed in the selected Naver tab after the advertiser has logged in and
// chosen an account. The web page's earlier checkbox is not this confirmation.
export function confirmAdvertiserInvitation({accountId,viewerId,preconsented=false}) {
  if(!/^[1-9][0-9]{0,15}$/.test(accountId||'')||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId||'')||viewerId==='kitsnode')return false;
  const u=new URL(location.href);
  if(u.origin!=='https://ads.naver.com'||u.pathname!==`/manage/ad-accounts/${accountId}/settings/authorities/members/invited`||u.search||u.hash)return false;
  const links=[...document.querySelectorAll('a')].filter(e=>e.getClientRects().length>0&&e.href==='https://ads.naver.com/settings/profile-info'&&e.textContent.trim());
  if(links.length!==1||links[0].textContent.trim()!==viewerId)return false;
  return preconsented===true || window.confirm(`광고주 ${viewerId}의 광고계정 ${accountId}에서 kitsnode에 운영 조회 권한을 초대하시겠습니까? 네이버의 정책 동의는 다음 화면에서 직접 확인해 주세요.`);
}

export async function advanceAdvertiserTab(chromeApi, tabId, {wait=()=>new Promise(resolve=>setTimeout(resolve,400)),attempts=75}={}) {
  const routed=await routeSelectedAdvertiserTab({chromeApi,tabId});
  if(routed.status==='routing') return routed;
  try {
    const tab=await chromeApi.tabs.get(tabId), u=new URL(tab.url);
    if(u.origin!=='https://ads.naver.com'||u.search||u.hash) return {status:'ignored'};
    const match=u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
    if(!match)return {status:'ignored'};
    const records=await chromeApi.storage.session.get(null);
    const pending=Object.entries(records).filter(([key,r])=>key.startsWith('web_start_')&&(['account_routing'].includes(r?.state)||(r?.state==='account_selected'&&r.expectedConsentId&&!r.controllerLaunch))&&r.naverTabId===tabId&&r.accountId===match[1]);
    if(pending.length!==1)return {status:'blocked'};
    const nonce=pending[0][0].slice('web_start_'.length);
    if(pending[0][1].state==='account_routing'&&(await bindSelectedAccount({chromeApi,nonce,tabId,accountId:match[1]})).status!=='account_selected')return {status:'blocked'};
    const preconsented=Boolean(pending[0][1].expectedConsentId);
    const run=()=>startAutomaticInvite({chromeApi,nonce,flow:preconsented?'consent-v2':'manual',confirmAction:async identity=>{
      if(identity.accountId!==match[1])return false;
      const answer=await chromeApi.scripting.executeScript({target:{tabId},func:confirmAdvertiserInvitation,args:[{...identity,preconsented}]});
      if(answer?.length!==1||answer[0]?.result!==true)return false;
      const active=await chromeApi.tabs.query({active:true,currentWindow:true});
      const expected=`https://ads.naver.com/manage/ad-accounts/${identity.accountId}/settings/authorities/members/invited`;
      if(active.length!==1||active[0]?.id!==tabId||active[0]?.url!==expected)return false;
      const bound=await getBoundAdvertiserTab({chromeApi,nonce});
      if(bound.status!=='bound'||bound.tabId!==tabId||bound.accountId!==identity.accountId)return false;
      const current=await chromeApi.scripting.executeScript({target:{tabId},func:captureAdvertiser});
      return current?.length===1&&current[0]?.result?.accountId===identity.accountId&&current[0]?.result?.viewerId===identity.viewerId;
    }});
    // Only a server-consent-bound start can wait for SPA hydration or the
    // user returning to the bound Naver tab. No policy/submit action occurs
    // until the controller subsequently receives server proof.
    let started='blocked';
    for(let i=0;i<(preconsented?attempts:1);i++){
      const bound=await getBoundAdvertiserTab({chromeApi,nonce});
      if(bound.status!=='bound'||bound.tabId!==tabId||bound.accountId!==match[1])return {status:'blocked'};
      const key='web_start_'+nonce,current=(await chromeApi.storage.session.get(key))[key];
      if(!current||current.controllerLaunch)return {status:'blocked'};
      // Persist before launching; if the worker crashes the operation fails
      // closed instead of creating a second controller on a later event.
      if(preconsented)await chromeApi.storage.session.set({[key]:{...current,controllerLaunch:true}});
      started=await run();
      if(started==='started')break;
      if(preconsented){const latest=(await chromeApi.storage.session.get(key))[key];if(!latest||latest.controllerLaunch!==true)return {status:'blocked'};await chromeApi.storage.session.set({[key]:{...latest,controllerLaunch:false}});}
      if(i+1<attempts&&preconsented)await wait();
    }
    if(started==='started')return {status:'controller_started'};
    return {status:started==='cancelled'?'cancelled':'blocked'};
  } catch { return {status:'unavailable'}; }
}

// An external start only opens a fixed Naver page. An invitation requires the
// advertiser’s subsequent confirmation and direct Naver policy acceptance.
const registered = new WeakSet();
export function registerWebStartWorker(chromeApi) {
  if (registered.has(chromeApi)) return;
  registered.add(chromeApi);
  const pendingTabs=new Set();
  const advancingTabs=new Set(), rerunTabs=new Set();
  function scheduleAdvance(tabId){
    if(advancingTabs.has(tabId)){rerunTabs.add(tabId);return;}
    advancingTabs.add(tabId);
    void (async()=>{do{rerunTabs.delete(tabId);const result=await advanceAdvertiserTab(chromeApi,tabId);if(result.status==='routing')rerunTabs.add(tabId);}while(rerunTabs.delete(tabId));})().finally(()=>{advancingTabs.delete(tabId);if(rerunTabs.delete(tabId))scheduleAdvance(tabId);});
  }
  chromeApi.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    const tabId=sender?.tab?.id;
    if(!Number.isInteger(tabId)||pendingTabs.has(tabId)){sendResponse({status:'blocked'});return false;}
    pendingTabs.add(tabId);
    const v2=['kitsnode.proof.start.v2','kitsnode.proof.prepare.v2','kitsnode.proof.get.v2','kitsnode.proof.approved.v2'].includes(message?.type);
    void (message?.type?.startsWith('kitsnode.account.')?accountDiscovery({chromeApi,message,sender}):v2?candidateWebMessageV2({chromeApi,message,sender}):openAdvertiserLogin({chromeApi, message, sender})).then(sendResponse, () => sendResponse({status:'unavailable'})).finally(()=>pendingTabs.delete(tabId));
    return true;
  });
  chromeApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if(changeInfo.status!=='complete')return;
    scheduleAdvance(tabId);
  });
  // A bound v2 tab may become active only after the bounded wait has elapsed.
  // Manual starts and already launched controllers do not become eligible.
  chromeApi.tabs.onActivated?.addListener(({tabId})=>{if(Number.isInteger(tabId))scheduleAdvance(tabId);});
}
if (globalThis.chrome?.runtime?.onMessageExternal) registerWebStartWorker(globalThis.chrome);
