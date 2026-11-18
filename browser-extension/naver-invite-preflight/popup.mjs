import {prepareActiveTab,executeInviteStep} from './preflight.mjs';
import {sendInvite,inspectInvite} from './send-invite.mjs';
import {startAutomaticInvite} from './automatic-start.mjs';
const status = document.querySelector('#status');
document.querySelector('#auto').addEventListener('click',async()=>{
  const button=document.querySelector('#auto');button.disabled=true;
  try{
    const result=await startAutomaticInvite({chromeApi:chrome,nonce:crypto.randomUUID(),confirmAction:({accountId,viewerId})=>confirm(`네이버 ${viewerId} 계정의 광고계정 ${accountId}에서 kitsnode에 운영 관리 권한 초대를 자동으로 보낼까요? 네이버 초대 정책은 직접 확인하고 동의해 주세요.`)});
    status.textContent=result==='started'?'네이버 화면에서 초대 정책을 확인하고 동의해 주세요. 이후 자동으로 진행합니다.':result==='cancelled'?'자동 진행을 취소했습니다.':'로그인된 광고계정의 권한 관리 화면을 확인하지 못했습니다.';
  }catch{status.textContent='자동 진행을 시작하지 못했습니다.';}finally{button.disabled=false;}
});
document.querySelector('#open').addEventListener('click', async () => {
  try { await chrome.tabs.create({url:'https://ads.naver.com/settings/ad-account'}); }
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
  status.textContent=result==='next_requested'?'운영 관리 권한을 확인해 주세요.':'가입 여부 조회 결과를 확인하지 못했습니다.';
});
document.querySelector('#diagnose').addEventListener('click',async()=>{
 const result=await inspectInvite({chromeApi:chrome,execute:executeInviteStep});
 const messages={blocked:'광고계정 탭을 확인하지 못했습니다.',viewer_unverified:'로그인된 광고주 ID를 확인하지 못했습니다.',role_unverified:'수신자 또는 운영 관리 권한을 확인하지 못했습니다.',previous_attempt:'이전에 발송을 시도한 기록이 있습니다. 네이버에서 초대 상태를 확인해 주세요.',ready:'광고주·수신자·권한이 확인됐으며 이전 발송 시도 기록이 없습니다.',unavailable:'확인 중 오류가 발생했습니다.'};
 status.textContent=messages[result]||messages.unavailable;
});
document.querySelector('#send').addEventListener('click',async()=>{
  const buttons=document.querySelectorAll('button');for(const b of buttons)b.disabled=true;
  try{
    const result = await sendInvite({chromeApi:chrome,execute:executeInviteStep,locks:navigator.locks,
      confirmAction:({accountId})=>confirm(`광고계정 ${accountId}에서 kitsnode에 운영 관리 권한을 부여하는 초대를 보낼까요?`)});
    const messages={blocked:'광고계정 화면을 확인하지 못했습니다.',viewer_unverified:'광고주 ID를 확인하지 못했습니다.',role_unverified:'수신자 또는 운영 관리 권한을 확인하지 못했습니다.',unavailable:'이 브라우저에서 동시 실행을 제한할 수 없습니다.',in_progress:'같은 광고계정의 초대 작업이 진행 중입니다.',previous_attempt:'이전에 발송을 시도했습니다. 네이버의 초대 상태를 직접 확인해 주세요.',cancelled:'초대를 취소했습니다.',uncertain:'발송 결과를 확인할 수 없습니다. 네이버의 초대 중인 회원을 직접 확인해 주세요. 자동 재시도하지 않습니다.'};
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
