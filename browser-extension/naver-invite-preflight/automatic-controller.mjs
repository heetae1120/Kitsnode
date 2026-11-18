import {runAutomaticInviteInTab} from './automatic-driver.mjs';
import {automaticInviteStep} from './automatic-invite.mjs';

// The inactive extension tab survives popup closure while the user checks
// Naver's policy. Session binding contains IDs only, never credentials.
export async function runAutomaticController({chromeApi,locks,nonce,wait,onStatus=()=>{}}) {
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(nonce||'')||!locks?.request||!chromeApi?.storage?.session||typeof wait!=='function')return {status:'blocked'};
 return locks.request('controller_'+nonce,{ifAvailable:true},async lock=>{
  if(!lock)return {status:'blocked'};
  const key='automatic_start_'+nonce;
  let binding;
  try{binding=(await chromeApi.storage.session.get(key))[key];await chromeApi.storage.session.remove(key);}catch{return {status:'blocked'}}
  if(!binding||binding.approved!==true||!Number.isInteger(binding.tabId)||!Number.isFinite(binding.createdAt)||Date.now()-binding.createdAt>60000||binding.createdAt>Date.now())return {status:'blocked'};
  const {tabId,accountId,viewerId}=binding;
  const url=`https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`;
  const waitForPolicy=async()=>{
   onStatus('네이버 화면에서 초대 정책을 확인하고 동의해 주세요.');
   for(let i=0;i<600;i++){
    await wait();
    const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
    if(tabs.length!==1||tabs[0].id!==tabId||tabs[0].url!==url)return false;
    const r=await chromeApi.scripting.executeScript({target:{tabId},func:automaticInviteStep,args:[{action:'policy_inspect',accountId,viewerId}]});
    const value=r?.length===1?r[0]?.result:'unverified';
    if(value==='policy_confirmed'||value==='policy_advanced')return true;
    if(!['policy_required','waiting'].includes(value))return false;
   }
   return false;
  };
  const result=await runAutomaticInviteInTab({chromeApi,tabId,accountId,viewerId,locks,waitForPolicy,wait,
   consent:{approved:true,accountId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER'}});
  const messages={tab_changed:'선택된 광고계정 탭이 바뀌어 초대 전 중단했습니다.',viewer_unverified:'로그인된 광고주 ID를 확인하지 못해 초대 전 중단했습니다.',role_unverified:'수신자 또는 운영 관리 권한을 확인하지 못해 초대 전 중단했습니다.',previous_attempt:'이전에 발송이 시도된 기록이 있습니다. 네이버에서 초대 상태를 확인해 주세요.',in_progress:'같은 광고계정의 다른 초대 작업이 진행 중입니다.',unavailable:'동시 실행 제한 기능을 사용할 수 없어 초대 전 중단했습니다.',cancelled:'초대를 취소했습니다.',blocked:'광고계정 화면을 확인하지 못해 초대 전 중단했습니다.'};
  onStatus(result.status==='uncertain'?'초대 결과를 네이버에서 직접 확인해 주세요. 자동으로 재시도하지 않습니다.':messages[result.reason]||'자동 진행이 중단됐습니다. 네이버 화면을 확인해 주세요.');
  return result;
 });
}

if(typeof document!=='undefined'&&typeof chrome!=='undefined'){
 const status=document.querySelector('#status');
 void runAutomaticController({chromeApi:chrome,locks:navigator.locks,nonce:location.hash.slice(1),wait:()=>new Promise(resolve=>setTimeout(resolve,500)),onStatus:text=>{status.textContent=text;}}).catch(()=>{status.textContent='자동 진행을 시작하지 못했습니다.';});
}
