// Invoked only by a user gesture in the extension popup. No credentials are read.
export function captureAdvertiser() {
 const u=new URL(location.href), match=u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
 if(!match)return null;
 const links=[...document.querySelectorAll('a')].filter(e=>e.getClientRects().length>0&&e.href==='https://ads.naver.com/settings/profile-info'&&e.textContent.trim());
 if(links.length!==1)return null;
 const viewerId=links[0].textContent.trim();
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId)||viewerId==='kitsnode')return null;
 return {accountId:match[1],viewerId};
}
export async function startAutomaticInvite({chromeApi, confirmAction, nonce}) {
 if(typeof confirmAction!=='function'||typeof nonce!=='string'||!/^[-a-zA-Z0-9]{20,80}$/.test(nonce)||!chromeApi?.storage?.session)return 'blocked';
 try {
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});const tab=tabs.length===1?tabs[0]:null;
  if(!Number.isInteger(tab?.id))return 'blocked';
  const result=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:captureAdvertiser});
  const identity=result?.length===1?result[0]?.result:null;
  if(!identity||!/^[1-9][0-9]{0,15}$/.test(identity.accountId||'')||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(identity.viewerId||'')||identity.viewerId==='kitsnode')return 'blocked';
  const url=`https://ads.naver.com/manage/ad-accounts/${identity.accountId}/settings/authorities/members/invited`;
  if(tab.url!==url)return 'blocked';
  if(await confirmAction(identity)!==true)return 'cancelled';
  await chromeApi.storage.session.set({['automatic_start_'+nonce]:{tabId:tab.id,...identity,approved:true,createdAt:Date.now()}});
  try {await chromeApi.tabs.create({url:chromeApi.runtime.getURL(`automatic-controller.html#${nonce}`),active:false});}
  catch {await chromeApi.storage.session.remove('automatic_start_'+nonce);return 'blocked';}
  return 'started';
 }catch{return 'blocked'}
}
