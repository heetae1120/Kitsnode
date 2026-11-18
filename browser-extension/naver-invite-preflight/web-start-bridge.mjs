// Test candidate only. Opening the login page does not authenticate a member,
// identify an ad account, approve an invitation, or grant authority to mutate.
// The actual service worker/manifest is deliberately not wired yet.
const ORIGIN = 'https://heetae1120.github.io';
const PATH = '/Kitsnode/store/ads/connect/';
const validNonce = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function validSender(sender) {
  try {
    if (!Number.isInteger(sender?.tab?.id) || sender.frameId !== 0 || typeof sender.url !== 'string') return false;
    const a = new URL(sender.url);
    // sender.url is supplied by Chrome for the frame; tab.url may be absent
    // when the extension has no host permission for the calling website.
    return a.origin === ORIGIN && a.pathname === PATH && !a.search && !a.hash;
  } catch { return false; }
}

// Routes a user-selected Naver account to its member-management page. Only an
// unexpired tab created by this extension is eligible. This does not create an
// invitation; a separate reviewed workflow must handle consent and sending.
export async function routeSelectedAdvertiserTab({chromeApi,tabId,now = Date.now} = {}) {
  if (!Number.isInteger(tabId)) return {status:'blocked'};
  try {
    const tab=await chromeApi.tabs.get(tabId), u=new URL(tab.url), stamp=now();
    if (u.origin!=='https://ads.naver.com' || u.search || u.hash) return {status:'ignored'};
    const match=u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/(?:dashboard|all-campaigns)$/);
    if (!match) return {status:'ignored'};
    const rows=await chromeApi.storage.session.get(null);
    const eligible=Object.entries(rows).filter(([key,record])=>key.startsWith('web_start_') && record?.state==='login_opened' && record.naverTabId===tabId && Number.isSafeInteger(stamp) && stamp>=record.createdAt && stamp<record.expiresAt);
    if(eligible.length!==1) return {status:'blocked'};
    const [key,record]=eligible[0];
    await chromeApi.storage.session.set({[key]:{...record,state:'account_routing',accountId:match[1]}});
    await chromeApi.tabs.update(tabId,{url:`https://ads.naver.com/manage/ad-accounts/${match[1]}/settings/authorities/members/invited`});
    return {status:'routing'};
  } catch { return {status:'unavailable'}; }
}

export async function openAdvertiserLogin({chromeApi, message, sender, now = Date.now} = {}) {
  if (!validSender(sender) || !message || Object.keys(message).sort().join(',') !== 'consent,nonce,type' || message.consent !== true ||
      message.type !== 'kitsnode.open-advertiser-login.v1' || !validNonce(message.nonce)) return {status:'blocked'};
  if (!chromeApi?.tabs?.create || !chromeApi?.storage?.session?.set || !chromeApi?.storage?.session?.get) return {status:'unavailable'};
  const stamp = now();
  if (!Number.isSafeInteger(stamp) || stamp < 0) return {status:'unavailable'};
  let tab;
  try {
    // Bound the number of unexpired starts in this profile. The service-worker
    // listener also serializes concurrent messages per source tab; neither is
    // a durable server reservation or a defense against a compromised site.
    const existing=await chromeApi.storage.session.get(null);
    const records=Object.entries(existing).filter(([key,r])=>key.startsWith('web_start_')&&r&&Number.isSafeInteger(r.expiresAt)&&r.expiresAt>stamp);
    if(records.length>=3 || records.some(([key,r])=>key==='web_start_'+message.nonce || r.siteTabId===sender.tab.id)) return {status:'blocked'};
    // A fixed Naver URL only. No supplied destination, token or account data is accepted.
    tab = await chromeApi.tabs.create({url:'https://ads.naver.com/settings/ad-account'});
    if (!Number.isInteger(tab?.id)) return {status:'unavailable'};
    await chromeApi.storage.session.set({['web_start_'+message.nonce]:{
      siteTabId:sender.tab.id, naverTabId:tab.id, createdAt:stamp, expiresAt:stamp+10*60*1000, state:'login_opened', webConsent:true,
    }});
    // Nonce is correlation data, not proof of the user's or advertiser's identity.
    return {status:'opened',nonce:message.nonce};
  } catch {
    if (Number.isInteger(tab?.id) && typeof chromeApi.tabs.remove === 'function') { try { await chromeApi.tabs.remove(tab.id); } catch {} }
    return {status:'unavailable'};
  }
}

// Only trusted extension code calls this after the advertiser selects an
// account and navigates its Naver tab to that account's member-management
// screen. This performs no page mutation or identity/ownership authentication.
// storage.session get/set is not an atomic lock and cannot authorize sending.
export async function bindSelectedAccount({chromeApi, nonce, tabId, accountId, now = Date.now} = {}) {
  if (!validNonce(nonce) || !Number.isInteger(tabId) || !/^[1-9][0-9]{0,15}$/.test(accountId || '')) return {status:'blocked'};
  try {
    const key = 'web_start_'+nonce, record = (await chromeApi.storage.session.get(key))[key], stamp = now();
    if (!record || !['login_opened','account_routing'].includes(record.state) || (record.state==='account_routing' && record.accountId!==accountId) || record.naverTabId !== tabId || !Number.isSafeInteger(stamp) || stamp < record.createdAt || stamp >= record.expiresAt) return {status:'blocked'};
    const tab = await chromeApi.tabs.get(tabId), u = new URL(tab.url);
    if (u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || u.search || u.hash) return {status:'blocked'};
    await chromeApi.storage.session.set({[key]:{...record,state:'account_selected',accountId}});
    return {status:'account_selected',nonce,tabId,accountId};
  } catch { return {status:'unavailable'}; }
}

// Gate for a future extension state machine: re-read the same tab and bound
// account immediately before continuing. Separate durable authorization and
// ownership checks are still required before sending an invitation.
export async function getBoundAdvertiserTab({chromeApi, nonce, now = Date.now} = {}) {
  if (!validNonce(nonce)) return {status:'blocked'};
  try {
    const record=(await chromeApi.storage.session.get('web_start_'+nonce))['web_start_'+nonce], stamp=now();
    if (!record || record.state!=='account_selected' || !/^[1-9][0-9]{0,15}$/.test(record.accountId || '') || !Number.isInteger(record.naverTabId) || !Number.isSafeInteger(stamp) || stamp<record.createdAt || stamp>=record.expiresAt) return {status:'blocked'};
    const tab=await chromeApi.tabs.get(record.naverTabId), u=new URL(tab.url);
    if(u.origin!=='https://ads.naver.com' || u.pathname!==`/manage/ad-accounts/${record.accountId}/settings/authorities/members/invited` || u.search || u.hash) return {status:'blocked'};
    return {status:'bound',nonce,tabId:record.naverTabId,accountId:record.accountId};
  } catch { return {status:'unavailable'}; }
}
