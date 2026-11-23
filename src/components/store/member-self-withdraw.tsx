'use client';
import {useId, useRef, useState} from 'react';

export function MemberSelfWithdraw({withdraw}: {withdraw:()=>Promise<{ok:boolean;code:string}>}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const inFlight=useRef(false);
 const title=useId();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const close=()=>{if(!inFlight.current)dialog.current?.close()};
 const submit=async()=>{
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setMessage('');
  try {
   const result=await withdraw();
   if(result.ok){dialog.current?.close();setMessage('회원 탈퇴가 완료되었습니다. 다시 이용하려면 회원가입해 주세요.');}
   else setMessage(result.code==='pending'?'탈퇴 처리 결과를 확인하지 못했습니다. 로그인이 되지 않으면 탈퇴가 완료됐을 수 있습니다. 확인이 필요하면 고객센터로 문의해 주세요.':result.code==='admin_protected'?'관리자 계정은 고객 회원탈퇴를 이용할 수 없습니다.':result.code==='protected_reference'?'이 계정은 바로 탈퇴할 수 없습니다. 고객센터로 문의해 주세요.':'탈퇴 요청을 시작하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.');
  }catch{setMessage('탈퇴 처리 결과를 확인하지 못했습니다. 로그인이 되지 않으면 탈퇴가 완료됐을 수 있습니다. 확인이 필요하면 고객센터로 문의해 주세요.');}
  finally{inFlight.current=false;setBusy(false)}
 };
 return <section aria-label="회원 탈퇴">
  <h2>회원 탈퇴</h2><button type="button" onClick={()=>{setMessage('');dialog.current?.showModal()}}>회원 탈퇴</button>
  <dialog ref={dialog} aria-labelledby={title} onCancel={event=>{if(inFlight.current)event.preventDefault()}}>
   <h2 id={title}>회원 탈퇴를 진행할까요?</h2>
   <p>탈퇴하면 키츠노드 계정과 관련 정보가 삭제됩니다. 다시 이용하려면 회원가입이 필요합니다.</p>
   <p>네이버 광고 계정에 부여한 키츠노드 권한은 네이버에서 직접 해제해야 합니다. 설치한 확장프로그램도 직접 삭제할 수 있습니다.</p>
   {message&&dialog.current?.open&&<p role="status">{message}</p>}
   <button type="button" disabled={busy} onClick={close} autoFocus>취소</button>{' '}
   <button type="button" disabled={busy} onClick={()=>void submit()}>{busy?'처리 중…':'탈퇴하기'}</button>
  </dialog>
  {message&&!dialog.current?.open&&<p role="status">{message}</p>}
  <style jsx>{`
   dialog { box-sizing:border-box; width:min(480px,calc(100% - 32px)); max-width:none; border:1px solid #555; border-radius:16px; padding:24px; background:#1c1c1c; color:#f7f7f7; box-shadow:0 24px 80px #0009; }
   dialog::backdrop { background:#000b; }
   dialog h2 { margin:0 0 16px; font-size:20px; }
   dialog p { line-height:1.6; color:#ededed; }
   dialog button { margin-top:12px; padding:10px 18px; border:1px solid #777; border-radius:8px; color:#fff; background:#303030; cursor:pointer; }
   dialog button:last-child { border-color:#f26a36; background:#d84b1b; }
   dialog button:disabled { opacity:.55; cursor:wait; }
  `}</style>
 </section>;
}
