'use client';
import {useState} from 'react';
export function MemberSelfWithdraw({withdraw}: {withdraw:()=>Promise<{ok:boolean;code:string}>}) {
 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const submit=async()=>{if(busy||confirmation!=='회원 탈퇴')return;setBusy(true);setMessage('');try{const result=await withdraw();setMessage(result.ok?'회원 탈퇴가 완료되었습니다. 다시 이용하려면 회원가입해 주세요.':result.code==='pending'?'탈퇴 처리가 아직 완료되지 않았습니다. 처리가 지연되면 고객센터로 문의해 주세요.':'탈퇴를 완료하지 못했습니다. 다시 시도해 주세요.');}catch{setMessage('탈퇴를 완료하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false)}};
 return <section aria-label="회원 탈퇴"><h2>회원 탈퇴</h2>{!open?<button type="button" onClick={()=>setOpen(true)}>회원 탈퇴</button>:<div><p>탈퇴하면 키츠노드 계정과 관련 정보가 삭제됩니다. 다시 이용하려면 회원가입이 필요합니다.</p><p>네이버 광고 계정에 부여한 키츠노드 권한은 탈퇴 후에도 네이버에서 광고주가 직접 해제해야 합니다.</p><label>확인을 위해 ‘회원 탈퇴’를 입력해 주세요. <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></label><button type="button" disabled={busy||confirmation!=='회원 탈퇴'} onClick={()=>void submit()}>탈퇴하기</button><button type="button" disabled={busy} onClick={()=>{setOpen(false);setConfirmation('');}}>취소</button></div>}{message&&<p role="status">{message}</p>}</section>
}
