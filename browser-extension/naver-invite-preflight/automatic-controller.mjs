import {runAutomaticInviteInTab} from './automatic-driver.mjs';
import {automaticInviteStep} from './automatic-invite.mjs';
import {createCandidateConsentWorkflowV2} from './consent-controller-v2-candidate.mjs';

// Fixed deployment origin. Tests replace the copied module, never this file.
const PROOF_BASE='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/proof';
async function proofTransport(operation,body){
 const response=await fetch(`${PROOF_BASE}/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('proof_unavailable');return response.json();
}

// The inactive extension tab survives popup closure while the user checks
// Naver's policy. Session binding contains IDs only, never credentials.
export async function runAutomaticController({chromeApi,locks,nonce,wait,now=Date.now,onStatus=()=>{},proofWorkflowFactory}) {
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(nonce||'')||!locks?.request||!chromeApi?.storage?.session||typeof wait!=='function'){onStatus('자동 진행을 시작할 수 없어 초대 전 중단했습니다.');return {status:'blocked'};}
 return locks.request('controller_'+nonce,{ifAvailable:true},async lock=>{
  if(!lock){onStatus('같은 자동 진행이 이미 실행 중이어서 중단했습니다.');return {status:'blocked'};}
  const key='automatic_start_'+nonce;
  let binding;
  try{binding=(await chromeApi.storage.session.get(key))[key];await chromeApi.storage.session.remove(key);}catch{onStatus('시작 정보를 읽지 못해 초대 전 중단했습니다.');return {status:'blocked'}}
  if(!binding||binding.approved!==true||!Number.isInteger(binding.tabId)||!Number.isFinite(binding.createdAt)||now()-binding.createdAt>60000||binding.createdAt>now()){onStatus('시작 정보가 없거나 만료되어 초대 전 중단했습니다.');return {status:'blocked'};}
  const {tabId,accountId,viewerId}=binding;
  const expiresAt=binding.createdAt+5*60*1000;
  // Only fixed status strings are stored; do not persist account or identity.
  let pendingStatus=Promise.resolve();
  const report=message=>{onStatus(message);pendingStatus=pendingStatus.then(()=>chromeApi.storage.session.set({[`automatic_status_${tabId}_${nonce}`]:{message,attemptId:nonce,updatedAt:Date.now()}})).catch(()=>{});};
  const url=`https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`;
 // The v2 workflow may only be selected for starts explicitly bound to the
 // web consent flow. Standalone popup starts retain the manual policy path.
  let proofWorkflow;
 if(binding.flow==='consent-v2'&&!proofWorkflowFactory){const web=(await chromeApi.storage.session.get('web_start_'+nonce))['web_start_'+nonce];if(!web?.expectedConsentId){report('사전 동의 정보를 확인하지 못해 중단했습니다.');await pendingStatus;return {status:'blocked',reason:'proof_unavailable'};}proofWorkflowFactory=opts=>createCandidateConsentWorkflowV2({...opts,redeemTransport:body=>proofTransport('redeem',body),beginTransport:body=>proofTransport('begin',body)});}
  if(proofWorkflowFactory){try{proofWorkflow=await proofWorkflowFactory({chromeApi,nonce,tabId,accountId,viewerId,expiresAt,wait,now});if(typeof proofWorkflow?.authorizePolicy!=='function'||typeof proofWorkflow?.beginSend!=='function')throw Error('invalid_proof_workflow');}catch{report('사전 동의 검증을 시작하지 못해 중단했습니다.');await pendingStatus;return {status:'blocked',reason:'proof_unavailable'};}}
  const waitForPolicy=async()=>{
   report('네이버 화면에서 초대 정책을 확인하고 동의해 주세요.');
   let missingDialog=0;
   for(let i=0;i<600;i++){
    await wait();
    if(now()>=expiresAt)return false;
    // A closed or navigated bound tab is a cancellation, even when inactive.
    let boundTab;try{boundTab=await chromeApi.tabs.get(tabId);}catch{return false;}
    if(boundTab?.id!==tabId||boundTab.url!==url)return false;
    const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
    // A user may open a status tab or another window while reading policy.
    // Never interact with it; resume only when the same bound tab is active.
    if(tabs.length!==1||tabs[0].id!==tabId)continue;
    if(tabs[0].url!==url)return false;
    const r=await chromeApi.scripting.executeScript({target:{tabId},func:automaticInviteStep,args:[{action:'policy_inspect',accountId,viewerId}]});
    const value=r?.length===1?r[0]?.result:'unverified';
    if(value==='policy_confirmed'||value==='policy_advanced')return true;
    if(value==='waiting'){if(++missingDialog>=8)return false;continue;}
    if(value==='policy_required'){missingDialog=0;continue;}
    return false;
   }
   return false;
  };
  const stages={policy:'네이버 초대 정책 확인을 기다리고 있습니다.',recipient:'수신자 ID를 확인하고 있습니다.',role:'운영 조회 권한을 확인하고 있습니다.',send:'초대 발송을 시도하고 있습니다.'};
  const result=await runAutomaticInviteInTab({chromeApi,tabId,accountId,viewerId,locks,waitForPolicy,wait,expiresAt,now,authorizePolicy:proofWorkflow?.authorizePolicy,beforeSend:proofWorkflow?.beginSend,onStage:stage=>report(stages[stage]||'자동 진행 중입니다.'),
   consent:{approved:true,accountId,recipientId:'kitsnode',role:'OPERATIONS_VIEWER'}});
  const messages={recipient_dialog_missing:'네이버 초대창을 찾지 못해 ID 입력을 중단했습니다.',recipient_prompt_timeout:'ID 입력 단계가 준비되지 않아 중단했습니다.',recipient_input_timeout:'ID 입력란이 나타나지 않아 중단했습니다.',recipient_input_ambiguous:'ID 입력란이 여러 개여서 중단했습니다.',recipient_resets:'ID 입력값이 계속 초기화되어 중단했습니다.',lookup_button_timeout:'가입 여부 조회 버튼이 활성화되지 않아 중단했습니다.',binding_expired:'연결 요청의 유효시간이 만료돼 ID 입력 전 중단했습니다.',tab_navigated:'광고계정 탭의 주소가 변경돼 ID 입력 전 중단했습니다.',fill_url:'광고계정 주소가 예상과 달라 ID 입력 전 중단했습니다.',fill_viewer:'광고주 로그인 계정을 다시 확인하지 못해 ID 입력 전 중단했습니다.',fill_dialog:'회원 초대 화면이 중복돼 ID 입력 전 중단했습니다.',fill_nonempty:'ID 입력란에 다른 값이 있어 변경하지 않고 중단했습니다.',fill_setter:'ID 입력 기능을 사용할 수 없어 중단했습니다.',open_timeout:'초대 화면이 열리는 시간이 초과돼 중단했습니다.',open_unverified:'초대 화면과 광고주를 확인하지 못해 중단했습니다.',policy_timeout:'정책 화면이 준비되지 않아 중단했습니다.',policy_changed:'네이버 초대 정책 내용이 변경되었거나 확인할 수 없어 자동 동의를 중단했습니다.',policy_unverified:'정책 확인 또는 광고주 탭을 확인하지 못해 중단했습니다.',recipient_unverified:'수신자 ID 입력 화면이 예상과 달라 중단했습니다.',lookup_timeout:'ID 입력 또는 가입 여부 조회가 준비되지 않아 중단했습니다.',lookup_unverified:'수신자 ID와 조회 화면을 확인하지 못해 중단했습니다.',next_timeout:'가입 여부 조회 결과가 준비되지 않아 중단했습니다.',next_unverified:'가입 여부 조회 결과가 예상과 달라 중단했습니다.',role_timeout:'운영 조회 권한 선택이 준비되지 않아 중단했습니다.',execution_error:'초대 전 자동 진행 중 오류가 발생했습니다.',tab_changed:'선택된 광고계정 탭이 바뀌어 초대 전 중단했습니다.',viewer_unverified:'로그인된 광고주 ID를 확인하지 못해 초대 전 중단했습니다.',role_unverified:'수신자 또는 운영 조회 권한을 확인하지 못해 초대 전 중단했습니다.',previous_attempt:'이전에 발송이 시도된 기록이 있습니다. 네이버에서 초대 상태를 확인해 주세요.',in_progress:'같은 광고계정의 다른 초대 작업이 진행 중입니다.',unavailable:'동시 실행 제한 기능을 사용할 수 없어 초대 전 중단했습니다.',cancelled:'초대를 취소했습니다.',blocked:'광고계정 화면을 확인하지 못해 초대 전 중단했습니다.'};
  report(result.status==='uncertain'?'초대 결과를 네이버에서 직접 확인해 주세요. 자동으로 재시도하지 않습니다.':messages[result.reason]||'자동 진행이 중단됐습니다. 네이버 화면을 확인해 주세요.');
  await pendingStatus;
  return result;
 });
}

if(typeof document!=='undefined'&&typeof chrome!=='undefined'){
 const status=document.querySelector('#status');
 status.textContent='자동 진행을 준비하고 있습니다.';
 void runAutomaticController({chromeApi:chrome,locks:navigator.locks,nonce:location.hash.slice(1),wait:()=>new Promise(resolve=>setTimeout(resolve,500)),onStatus:text=>{status.textContent=text;}}).catch(()=>{status.textContent='자동 진행을 시작하지 못했습니다.';});
}
