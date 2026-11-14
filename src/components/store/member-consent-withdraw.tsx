'use client';
import React, {useState} from 'react';

export function MemberConsentWithdraw({withdraw,onWithdrawn}: {withdraw:()=>Promise<{ok:boolean}>;onWithdrawn:()=>void}) {
  const [confirming,setConfirming]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    try {const result=await withdraw();if(result.ok)onWithdrawn();else setError('동의 기록을 철회하지 못했습니다. 다시 시도해 주세요.');}
    catch {setError('동의 기록을 철회하지 못했습니다. 다시 시도해 주세요.');}
    finally {setBusy(false);}
  };
  return <section aria-label="키츠노드 동의 관리">
    <p>회원 탈퇴와 개인정보 삭제를 원하시면 <a href="mailto:jonho1@naver.com?subject=%ED%82%A4%EC%B8%A0%EB%85%B8%EB%93%9C%20%ED%9A%8C%EC%9B%90%20%ED%83%88%ED%87%B4%20%EB%B0%8F%20%EC%82%AD%EC%A0%9C%20%EC%9A%94%EC%B2%AD">개인정보 문의처</a>로 요청해 주세요. 본인 확인 후 처리하며, 다른 서비스와 공유하는 계정과 기록은 별도로 확인합니다.</p>
    {!confirming ? <button type="button" onClick={()=>setConfirming(true)}>키츠노드 동의 철회</button> : <div>
      <p>이 동의 기록을 철회하면 키츠노드 이용 전에 안내를 다시 확인해야 합니다. Supabase 계정이나 다른 서비스의 정보가 삭제되는 것은 아닙니다.</p>
      <button type="button" disabled={busy} onClick={()=>void submit()}>동의 기록 철회하기</button>
      <button type="button" disabled={busy} onClick={()=>setConfirming(false)}>취소</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
