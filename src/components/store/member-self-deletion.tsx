'use client';
import React, {useRef, useState} from 'react';

/** Candidate only: enabling requires a reviewed server implementation and wiring. */
export const MEMBER_SELF_DELETION_ENABLED = process.env.NEXT_PUBLIC_MEMBER_DELETION_ENABLED === 'true';
export type DeletionResult = 'deleted' | 'blocked' | 'needs_review' | 'uncertain';

export function DeletionHelp({status}:{status:'blocked'|'needs_review'|'uncertain'}) {
  return <p role="alert">{status === 'blocked' ? '현재 탈퇴 요청을 진행할 수 없습니다.' : status === 'needs_review' ? '연결된 정보 확인이 필요해 자동 탈퇴를 진행하지 못했습니다.' : '탈퇴 처리 여부를 확인하지 못했습니다. 다시 요청하지 말고 로그인 상태를 확인해 주세요.'} 계정에 연결된 정보가 있으면 확인이 필요할 수 있습니다. <a href="mailto:jonho1@naver.com?subject=%ED%82%A4%EC%B8%A0%EB%85%B8%EB%93%9C%20%ED%9A%8C%EC%9B%90%20%ED%83%88%ED%87%B4%20%EB%AC%B8%EC%9D%98">개인정보 문의처에 문의해 주세요.</a></p>;
}

export function MemberSelfDeletion({remove,onDeleted}: {remove:()=>Promise<DeletionResult>;onDeleted:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  const [confirmation,setConfirmation]=useState('');
  const [status,setStatus]=useState<'idle'|'busy'|'blocked'|'needs_review'|'uncertain'|'deleted'>('idle');
  const submitting=useRef(false);
  const submit=async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if (submitting.current || confirmation !== '회원탈퇴' || status !== 'idle') return;
    submitting.current=true; setStatus('busy');
    try {
      const result=await remove();
      if (result === 'deleted') {
        setStatus('deleted');
        try { await onDeleted(); } catch { /* deletion already succeeded */ }
      } else setStatus(result);
    } catch { setStatus('uncertain'); }
  };
  return <section aria-label="회원 탈퇴">
    {!open ? <button type="button" onClick={()=>setOpen(true)}>회원 탈퇴</button> : <>
      <h2>회원 탈퇴</h2>
      <p>탈퇴 요청을 진행하면 계정과 연결된 정보가 삭제됩니다. 처리 범위는 서비스 준비가 완료되면 안내합니다. 네이버 서비스의 연결 해제는 별도로 확인해 주세요.</p>
      {status === 'deleted' ? <p role="status">회원 탈퇴가 완료되었습니다.</p> : <form onSubmit={event=>void submit(event)}>
        <label>확인을 위해 회원탈퇴를 입력해 주세요. <input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" disabled={status !== 'idle'}/></label>
        <button type="submit" disabled={confirmation !== '회원탈퇴' || status !== 'idle'}>탈퇴 요청</button>
        <button type="button" disabled={status === 'busy' || status === 'uncertain'} onClick={()=>{setOpen(false);setConfirmation('');setStatus('idle');submitting.current=false;}}>취소</button>
      </form>}
      {(status === 'blocked' || status === 'needs_review' || status === 'uncertain') && <DeletionHelp status={status}/>}
    </>}
  </section>;
}
