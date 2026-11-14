'use client';
import React, {useState} from 'react';
import {MEMBER_PRIVACY_VERSION, MEMBER_TERMS_VERSION, type ConsentEvidence} from '@/lib/member-consent.mjs';

export function MemberConsentGate({accept, signOut, onAccepted, basePath}: {
  accept:(evidence:ConsentEvidence)=>Promise<{ok:boolean}>;
  signOut:()=>Promise<unknown>;
  onAccepted:()=>void;
  basePath:string;
}) {
  const [terms,setTerms]=useState(false);
  const [privacy,setPrivacy]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const submit=async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if (!terms || !privacy || busy) return;
    setBusy(true); setError('');
    try {
      const result=await accept({termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION,termsAccepted:true,privacyAcknowledged:true});
      if (result.ok) onAccepted(); else setError('확인 내용을 저장하지 못했습니다. 다시 시도해 주세요.');
    } catch { setError('확인 내용을 저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="member-consent-title">
    <h2 id="member-consent-title">회원 이용 안내 확인</h2>
    <p>처음 로그인했거나 개인정보 처리방침이 변경된 경우 회원 이용을 시작하기 전에 아래 내용을 확인해 주세요.</p>
    <form onSubmit={submit}>
      <label><input type="checkbox" checked={terms} onChange={event=>setTerms(event.target.checked)} required disabled={busy}/> <a href={`${basePath}/terms/`} target="_blank" rel="noopener noreferrer">이용약관</a>에 동의합니다.</label>
      <label><input type="checkbox" checked={privacy} onChange={event=>setPrivacy(event.target.checked)} required disabled={busy}/> <a href={`${basePath}/privacy/`} target="_blank" rel="noopener noreferrer">임시 개인정보 처리방침</a>을 확인했습니다.</label>
      <button type="submit" disabled={!terms || !privacy || busy}>확인하고 계속하기</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy} onClick={()=>void signOut()}>로그아웃</button>
  </section>;
}
