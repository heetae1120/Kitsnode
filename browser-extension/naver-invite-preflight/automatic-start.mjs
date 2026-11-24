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
export async function startAutomaticInvite({chromeApi, confirmAction, nonce, flow='manual'}) {
 if(!['manual','consent-v2'].includes(flow))return 'blocked';
 if(typeof confirmAction!=='function'||typeof nonce!=='string'||!/^[-a-zA-Z0-9]{20,80}$/.test(nonce)||!chromeApi?.storage?.session)return 'blocked';
 let statusKey=null,started=false,failure='자동 진행을 시작하지 못했습니다.';
 const status=message=>({message,attemptId:nonce,updatedAt:Date.now()});
 try {
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});const tab=tabs.length===1?tabs[0]:null;
  if(!Number.isInteger(tab?.id))return 'blocked';
  let u;try{u=new URL(tab.url)}catch{return 'blocked'}
  if(u.origin!=='https://ads.naver.com'||u.search||u.hash||!/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname))return 'blocked';
  statusKey=`automatic_status_${tab.id}_${nonce}`;
  await chromeApi.storage.session.set({[`automatic_current_${tab.id}`]:nonce,[statusKey]:status('자동 진행 시작을 준비하고 있습니다.')});
  const result=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:captureAdvertiser});
  const identity=result?.length===1?result[0]?.result:null;
  if(!identity||!/^[1-9][0-9]{0,15}$/.test(identity.accountId||'')||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(identity.viewerId||'')||identity.viewerId==='kitsnode')return 'blocked';
  const url=`https://ads.naver.com/manage/ad-accounts/${identity.accountId}/settings/authorities/members/invited`;
  if(tab.url!==url)return 'blocked';
  if(await confirmAction(identity)!==true){failure='자동 진행 시작을 취소했습니다.';return 'cancelled';}
  await chromeApi.storage.session.set({['automatic_start_'+nonce]:{tabId:tab.id,...identity,approved:true,flow,createdAt:Date.now()},[statusKey]:status('자동 진행 시작을 기다리고 있습니다.')});
  try {await chromeApi.tabs.create({url:chromeApi.runtime.getURL(`automatic-controller.html#${nonce}`),active:false});}
  catch {await chromeApi.storage.session.remove('automatic_start_'+nonce);return 'blocked';}
  started=true;return 'started';
 }catch{return 'blocked'}finally{
  if(statusKey&&!started){try{await chromeApi.storage.session.set({[statusKey]:status(failure)});}catch{}}
 }
}
