// Injected function is self-contained: chrome.scripting serializes its body.
// It opens a dialog only; it never checks a policy box, enters credentials,
// sends an invitation, reads cookies, or communicates with Kitsnode.
export function openInviteDialog() {
  const u = new URL(location.href);
  if (u.origin !== 'https://ads.naver.com' || !/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname) || u.search || u.hash) return 'wrong_page';
  const visible = e => e.getClientRects().length > 0;
  const profiles = [...document.querySelectorAll('a')].filter(e => visible(e) && e.href === 'https://ads.naver.com/settings/profile-info' && e.textContent.trim());
  const buttons = [...document.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.textContent.trim() === '회원 초대');
  const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
  if (profiles.length !== 1 || profiles[0].textContent.trim() === 'kitsnode' || buttons.length !== 1 || dialogs.length) return 'unverified';
  buttons[0].click();
  return 'dialog_requested';
}

export async function prepareActiveTab(chromeApi) {
  const tabs = await chromeApi.tabs.query({active:true,currentWindow:true});
  const tab = tabs.length === 1 ? tabs[0] : null;
  if (!tab || !Number.isInteger(tab.id) || typeof tab.url !== 'string') return 'wrong_page';
  let u;
  try { u = new URL(tab.url); } catch { return 'wrong_page'; }
  if (u.origin !== 'https://ads.naver.com' || !/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname) || u.search || u.hash) return 'wrong_page';
  try {
    const results = await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:openInviteDialog});
    return results?.length === 1 && ['dialog_requested','wrong_page','unverified'].includes(results[0]?.result) ? results[0].result : 'unverified';
  } catch { return 'unverified'; }
}

// This candidate operates exclusively on the currently selected Naver account.
// All checks are repeated within the same injected task immediately before a click.
export function inviteStep(action, expectedUrl, expectedViewerId) {
  const u = new URL(location.href);
  if (u.origin !== 'https://ads.naver.com' || !/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname) || u.search || u.hash || (expectedUrl && u.href !== expectedUrl)) return 'unverified';
  const visible=e=>{
    if(!e.getClientRects().length||e.closest('[aria-hidden="true"],[inert]'))return false;
    for(let node=e;node&&node.nodeType===1;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;}
    return true;
  };
  // Naver's styled radio inputs may themselves be transparent. Its label and
  // every ancestor must still be visible and interactable.
  const visibleChoice=e=>{
    if(!e.getClientRects().length||e.closest('[aria-hidden="true"],[inert]'))return false;
    for(let node=e;node&&node.nodeType===1;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||(node!==e&&Number(style.opacity)===0))return false;}
    return [...(e.labels||[])].some(visible);
  };
  const profiles=[...document.querySelectorAll('a')].filter(e=>visible(e)&&e.href==='https://ads.naver.com/settings/profile-info'&&e.textContent.trim());
  const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(e=>visible(e)&&e.getAttribute('aria-label')==='회원 초대');
  if(profiles.length!==1 || profiles[0].textContent.trim()==='kitsnode' || dialogs.length!==1)return 'unverified';
  const viewerId=profiles[0].textContent.trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId))return 'unverified';
  if(action==='viewer') return `viewer:${viewerId}`;
  if((action==='send'||action==='inspect_send') && (!expectedViewerId || expectedViewerId!==viewerId))return 'unverified';
  const dialog=dialogs[0], text=dialog.innerText.replace(/\s+/g,' ').trim();
  const buttons=label=>[...dialog.querySelectorAll('button')].filter(e=>visible(e)&&!e.disabled&&e.innerText.trim()===label);
  const inputs=[...dialog.querySelectorAll('input')].filter(e=>visible(e)&&(e.type==='text'||e.type===''));
  if(action==='lookup') {
    if(!text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.')||inputs.length!==1)return 'unverified';
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    if(!setter)return 'unverified';
    setter.call(inputs[0],'kitsnode');inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
    return 'recipient_filled';
  }
  if(action==='next') {
    if(inputs.length!==1||inputs[0].value!=='kitsnode'||!text.includes('초대 가능한 회원 ID입니다.')||buttons('다음').length!==1)return 'unverified';
    buttons('다음')[0].click();return 'next_requested';
  }
  if(action==='inspect_send'||action==='send') {
    const radios=[...dialog.querySelectorAll('input[type="radio"]')].filter(visibleChoice);
    const checked=radios.filter(e=>e.checked);
    const label=checked.length===1?[...(checked[0].labels||[])].map(e=>e.innerText.trim()).join(' '):'';
    if(!/\bID\s*kitsnode\s*의\s*권한 레벨을 선택해 주세요\./.test(text)||radios.length!==2||label!=='운영 조회'||buttons('초대').length!==1)return 'unverified';
    if(action==='send'){buttons('초대')[0].click();return 'send_attempted';}
    return 'ready';
  }
  return 'unverified';
}

export async function executeInviteStep(chromeApi, action, expectedUrl, expectedTabId, expectedViewerId) {
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
  const tab=tabs.length===1?tabs[0]:null;
  if(!tab||!Number.isInteger(tab.id)||typeof tab.url!=='string'||(expectedTabId!==undefined&&tab.id!==expectedTabId))return 'unverified';
  let u;try{u=new URL(tab.url)}catch{return 'unverified'}
  if(u.origin!=='https://ads.naver.com'||!/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname)||u.search||u.hash||(expectedUrl&&u.href!==expectedUrl))return 'unverified';
  // Chrome requires script arguments to be JSON-serializable. Optional
  // bindings must be null rather than undefined, including for viewer lookup.
  try { const result=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:inviteStep,args:[action,expectedUrl??null,expectedViewerId??null]});return result?.length===1?result[0]?.result||'unverified':'unverified'; }
  catch{return 'unverified'}
}
