import {prepareActiveTab,executeInviteStep} from './preflight.mjs';
import {sendInvite,inspectInvite} from './send-invite.mjs';
import {startAutomaticInvite} from './automatic-start.mjs';
import {observeInviteStatus} from './invite-status.mjs';
import {automaticInviteStep} from './automatic-invite.mjs';
import {captureAdvertiser} from './automatic-start.mjs';

export async function inspectPolicySnapshot(chromeApi){
 try{
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true}),tab=tabs.length===1?tabs[0]:null;
  if(!Number.isInteger(tab?.id))return {status:'blocked'};
  const observed=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:captureAdvertiser});
  const identity=observed?.length===1?observed[0]?.result:null;if(!identity)return {status:'blocked'};
  const current=await chromeApi.tabs.query({active:true,currentWindow:true});if(current.length!==1||current[0].id!==tab.id||current[0].url!==tab.url)return {status:'blocked'};
  const result=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:automaticInviteStep,args:[{action:'policy_compare',...identity}]});
  return {status:result?.length===1?result[0]?.result:'blocked',...identity};
 }catch{return {status:'blocked'}}
}

// Both selected-tab metadata and the visible page are checked. This captures
// no credential and does not navigate, click or change the advertiser account.
export function captureStatusAdvertiser() {
 try {
  const u=new URL(location.href),match=u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/(?:invited|inviting)$/);
  if(!match)return null;
  const links=[...document.querySelectorAll('a')].filter(e=>e.getClientRects().length>0&&e.href==='https://ads.naver.com/settings/profile-info'&&e.textContent.trim());
  if(links.length!==1)return null;
  const viewerId=links[0].textContent.trim();
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId)||viewerId==='kitsnode')return null;
  return {accountId:match[1],viewerId};
 }catch{return null;}
}
export async function inspectCurrentInviteStatus(chromeApi) {
 try {
  const selected=async()=>{const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});return tabs.length===1?tabs[0]:null;};
  const tab=await selected();
  if(!Number.isInteger(tab?.id)||typeof tab.url!=='string')return 'unverified';
  const u=new URL(tab.url),match=u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/(?:invited|inviting)$/);
  if(!match)return 'unverified';
  const captured=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:captureStatusAdvertiser});
  const identity=captured?.length===1?captured[0]?.result:null;
  if(!identity||identity.accountId!==match[1]||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(identity.viewerId||'')||identity.viewerId==='kitsnode')return 'unverified';
  const before=await selected();if(before?.id!==tab.id||before.url!==tab.url)return 'unverified';
  const observed=await chromeApi.scripting.executeScript({target:{tabId:tab.id},func:observeInviteStatus,args:[identity]});
  const after=await selected();if(after?.id!==tab.id||after.url!==tab.url)return 'unverified';
  const result=observed?.length===1?observed[0]?.result:null;
  return ['pending_observed','member_observed','not_found'].includes(result)?result:'unverified';
 }catch{return 'unverified';}
}


// A visible, already accepted membership resolves the local uncertainty. This
// does not assert that this browser sent it, nor that the server is connected.
// Never clear on an empty/pending list; those cannot prove absence or success.
export async function reconcileAcceptedAttempt({chromeApi,locks,confirmAction,inspect=inspectCurrentInviteStatus}={}) {
 try {
  if(typeof locks?.request!=='function'||typeof confirmAction!=='function'||typeof chromeApi?.storage?.local?.remove!=='function')return 'unavailable';
  const selected=async()=>{const t=await chromeApi.tabs.query({active:true,currentWindow:true});return t.length===1?t[0]:null;};
  const tab=await selected();
  const u=new URL(tab?.url), match=u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
  if(!match||!Number.isInteger(tab?.id))return 'unverified';
  const key=`invite_attempt_${match[1]}_kitsnode`;
  return await locks.request(key,{ifAvailable:true},async lock=>{
   if(!lock)return 'in_progress';
   const original=(await chromeApi.storage.local.get(key))[key];
   if(!original)return 'no_attempt';
   if(!Number.isSafeInteger(original.attemptedAt)||original.attemptedAt<0)return 'unverified';
   if(await inspect(chromeApi)!=='member_observed')return 'unverified';
   const current=await selected();if(current?.id!==tab.id||current.url!==tab.url)return 'unverified';
   if(await confirmAction({accountId:match[1]})!==true)return 'cancelled';
   if(await inspect(chromeApi)!=='member_observed')return 'unverified';
   const after=await selected();if(after?.id!==tab.id||after.url!==tab.url)return 'unverified';
   const record=(await chromeApi.storage.local.get(key))[key];
   if(!record||record.attemptedAt!==original.attemptedAt)return 'unverified';
   await chromeApi.storage.local.remove(key);return 'reconciled';
  });
 }catch{return 'unavailable';}
}

// Display only the status stored for the selected Naver tab. It does not
// imply that an invitation was sent or accepted.
export async function readAutomaticProgress(chromeApi,now=Date.now()) {
 try {
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
  if(tabs.length!==1 || !Number.isInteger(tabs[0].id))return null;
  const u=new URL(tabs[0].url);
  if(u.origin!=='https://ads.naver.com' || u.search || u.hash || !/^\/manage\/ad-accounts\/[1-9][0-9]{0,15}\/settings\/authorities\/members\/invited$/.test(u.pathname))return null;
  const pointer='automatic_current_'+tabs[0].id;
  const nonce=(await chromeApi.storage.session.get(pointer))[pointer];
  if(typeof nonce!=='string'||!/^[-a-zA-Z0-9]{20,80}$/.test(nonce))return null;
  const key=`automatic_status_${tabs[0].id}_${nonce}`;
  const item=(await chromeApi.storage.session.get(key))[key];
  if(item?.attemptId!==nonce||typeof item?.message!=='string'||item.message.length>150||!Number.isFinite(item.updatedAt)||item.updatedAt>now||now-item.updatedAt>600000)return null;
  const latest=await chromeApi.tabs.query({active:true,currentWindow:true});
  const current=(await chromeApi.storage.session.get(pointer))[pointer];
  return latest.length===1&&latest[0].id===tabs[0].id&&latest[0].url===tabs[0].url&&current===nonce?`${item.message} (시도 ${nonce.slice(-8)})`:null;
 }catch{return null;}
}

if(typeof document !== 'undefined') {
document.querySelector('#policy-probe').addEventListener('click',async()=>{
  const result=await inspectPolicySnapshot(chrome);
  status.textContent=result.status==='policy_match'?`광고계정 ${result.accountId}의 네이버 정책 문구가 시험 기준과 일치합니다. 확인만 했으며 동의와 초대는 실행하지 않았습니다.`:result.status==='policy_changed'?'네이버 정책 문구가 시험 기준과 다르거나 완전히 표시되지 않았습니다. 동의와 초대는 실행하지 않았습니다.':'광고주 계정과 회원 초대 정책 화면을 확인하지 못했습니다. 동의와 초대는 실행하지 않았습니다.';
});
const status = document.querySelector('#status');
document.querySelector('#progress').addEventListener('click',async()=>{status.textContent=await readAutomaticProgress(chrome)||'현재 광고계정 탭에서 최근 자동 진행 상태를 확인하지 못했습니다.';});
document.querySelector('#observe').addEventListener('click',async()=>{
 const button=document.querySelector('#observe');button.disabled=true;
 try {
  const result=await inspectCurrentInviteStatus(chrome);
  const messages={pending_observed:'현재 네이버 화면에서 kitsnode의 운영 조회 초대 표시를 확인했습니다. 이번 작업으로 발송됐는지와 키츠노드 서버 연결은 별도로 확인해야 합니다.',member_observed:'현재 네이버 화면에서 kitsnode의 운영 조회 권한 보유 표시를 확인했습니다. 기존에 수락된 권한일 수 있으며 키츠노드 서버 연결은 별도로 확인해야 합니다.',not_found:'현재 네이버 화면에서 kitsnode를 확인하지 못했습니다. 다른 페이지나 초대 중인 회원·권한 받은 회원 목록도 직접 확인해 주세요.',unverified:'현재 화면을 확인하지 못했습니다. 광고주로 로그인해 광고 계정의 권한 관리 목록을 열고 다시 확인해 주세요.'};
  status.textContent=messages[result];
 }finally{button.disabled=false;}
});
document.querySelector('#reconcile').addEventListener('click',async()=>{
 const button=document.querySelector('#reconcile');button.disabled=true;
 try {
  const result=await reconcileAcceptedAttempt({chromeApi:chrome,locks:navigator.locks,confirmAction:({accountId})=>confirm(`광고계정 ${accountId}에서 kitsnode의 운영 조회 권한이 이미 보입니다. 이 브라우저에 남은 이전 발송 시도 기록을 정리할까요? 이 작업은 서버 연결을 확인하지 않습니다.`)});
  const messages={reconciled:'이 브라우저의 이전 시도 기록을 정리했습니다. 현재 권한이 유지되는 동안 다시 초대할 필요가 없습니다. 서버 연결은 별도로 확인해 주세요.',unverified:'권한 받은 회원 화면에서 kitsnode의 운영 조회 권한을 확인하지 못해 기록을 유지했습니다. 초대 중이거나 결과가 불확실한 경우 기록을 지우지 않습니다.',no_attempt:'정리할 발송 시도 기록이 없습니다.',cancelled:'기록 정리를 취소했습니다.',in_progress:'같은 계정의 초대 작업이 진행 중입니다. 완료 후 다시 확인해 주세요.',unavailable:'확인할 수 없어 기록을 유지했습니다.'};
  status.textContent=messages[result]||messages.unavailable;
 }finally{button.disabled=false;}
});
document.querySelector('#auto').addEventListener('click',async()=>{
  const button=document.querySelector('#auto');button.disabled=true;
  try{
    const result=await startAutomaticInvite({chromeApi:chrome,nonce:crypto.randomUUID(),confirmAction:({accountId,viewerId})=>confirm(`네이버 ${viewerId} 계정의 광고계정 ${accountId}에서 kitsnode에 운영 조회 권한 초대를 자동으로 보낼까요? 네이버 초대 정책은 직접 확인하고 동의해 주세요.`)});
    status.textContent=result==='started'?'네이버 화면의 초대 정책을 직접 확인하고 동의해 주세요. 이후 자동 진행을 시도합니다. 초대 발송과 수락 여부는 네이버에서 확인해 주세요.':result==='cancelled'?'자동 진행을 취소했습니다.':'광고주로 로그인한 뒤 광고 계정의 권한 관리 → 권한 받은 회원 화면에서 다시 시작해 주세요.';
  }catch{status.textContent='자동 진행을 시작하지 못했습니다.';}finally{button.disabled=false;}
});
document.querySelector('#open').addEventListener('click', async () => {
  try {
    const tabs=await chrome.tabs.query({active:true,currentWindow:true});
    let accountId;
    try { const u=new URL(tabs.length===1?tabs[0].url:''); if(u.origin==='https://ads.naver.com'&&!u.search&&!u.hash) accountId=u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})(?:\/|$)/)?.[1]; } catch {}
    await chrome.tabs.create({url:accountId?`https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`:'https://ads.naver.com/settings/ad-account'});
    status.textContent=accountId?'선택한 광고계정의 회원 관리 화면을 열었습니다.':'네이버애즈에서 로그인하고 광고계정을 선택한 뒤 권한 관리 → 회원 관리로 이동해 주세요.';
  }
  catch { status.textContent = '네이버 애즈를 열지 못했습니다.'; }
});
document.querySelector('#lookup').addEventListener('click', async()=>{
  const filled=await executeInviteStep(chrome,'lookup');
  if(filled!=='recipient_filled'){status.textContent='회원 ID 입력 화면을 확인하지 못했습니다.';return;}
  // React may enable the button asynchronously after the input event.
  status.textContent='kitsnode를 입력했습니다. 가입 여부 조회 버튼을 네이버 화면에서 눌러 주세요.';
});
document.querySelector('#next').addEventListener('click',async()=>{
  const result=await executeInviteStep(chrome,'next');
  status.textContent=result==='next_requested'?'운영 조회 권한을 확인해 주세요.':'가입 여부 조회 결과를 확인하지 못했습니다.';
});
document.querySelector('#diagnose').addEventListener('click',async()=>{
 const result=await inspectInvite({chromeApi:chrome,execute:executeInviteStep});
 const messages={blocked:'광고계정 탭을 확인하지 못했습니다.',viewer_unverified:'로그인된 광고주 ID를 확인하지 못했습니다.',role_unverified:'수신자 또는 운영 조회 권한을 확인하지 못했습니다.',previous_attempt:'이전에 발송을 시도한 기록이 있습니다. 네이버에서 초대 상태를 확인해 주세요.',ready:'광고주·수신자·권한이 확인됐으며 이전 발송 시도 기록이 없습니다.',unavailable:'확인 중 오류가 발생했습니다.'};
 status.textContent=messages[result]||messages.unavailable;
});
document.querySelector('#send').addEventListener('click',async()=>{
  const buttons=document.querySelectorAll('button');for(const b of buttons)b.disabled=true;
  try{
    const result = await sendInvite({chromeApi:chrome,execute:executeInviteStep,locks:navigator.locks,
      confirmAction:({accountId})=>confirm(`광고계정 ${accountId}에서 kitsnode에 운영 조회 권한으로 초대를 보낼까요? 발송 후 키츠노드 수락은 별도입니다.`)});
    const messages={blocked:'광고계정 화면을 확인하지 못했습니다.',viewer_unverified:'광고주 ID를 확인하지 못했습니다.',role_unverified:'수신자 또는 운영 조회 권한을 확인하지 못했습니다.',unavailable:'이 브라우저에서 동시 실행을 제한할 수 없습니다.',in_progress:'같은 광고계정의 초대 작업이 진행 중입니다.',previous_attempt:'이전에 발송을 시도했습니다. 네이버의 초대 상태를 직접 확인해 주세요.',cancelled:'초대를 취소했습니다.',uncertain:'발송 결과를 확인할 수 없습니다. 네이버의 초대 중인 회원을 직접 확인해 주세요. 자동 재시도하지 않습니다.'};
    status.textContent=messages[result]||'결과를 확인하지 못했습니다. 네이버에서 직접 확인해 주세요.';
  }catch{status.textContent='결과를 확인하지 못했습니다. 네이버에서 직접 확인해 주세요.';}
  finally{for(const b of buttons)b.disabled=false;}
});
document.querySelector('#prepare').addEventListener('click', async () => {
  status.textContent = '광고계정 화면을 확인하고 있습니다.';
  const result = await prepareActiveTab(chrome);
  status.textContent = result === 'dialog_requested'
    ? '초대 화면을 요청했습니다. 네이버 화면에서 정책을 직접 확인해 주세요. 초대는 발송되지 않았습니다.'
    : result === 'wrong_page'
      ? '네이버 애즈에 로그인한 뒤 연결할 광고계정의 권한 관리 → 권한 받은 회원 화면에서 다시 시도해 주세요.'
      : '로그인 또는 회원 초대 화면을 확인하지 못했습니다. 네이버 화면을 확인해 주세요.';
});
}
