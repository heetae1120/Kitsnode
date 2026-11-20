'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';
import {isDraftPreviewMode} from '@/lib/draft-preview-stage';

export function MemberMenu() {
  const [signedIn,setSignedIn]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if (isDraftPreviewMode()) return;
    const client=memberBrowserClient(); if (!client) return;
    let active=true;
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)setSignedIn(Boolean(session?.user));});
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  const logout=async ()=>{
    if(busy)return;
    setBusy(true);setError('');
    try {const result=await memberBrowserClient()?.auth.signOut(); if(!result || result.error)setError('로그아웃하지 못했습니다. 다시 시도해 주세요.');}
    catch {setError('로그아웃하지 못했습니다. 다시 시도해 주세요.');} finally {setBusy(false);}
  };
  return <>{signedIn ? <>{process.env.NEXT_PUBLIC_SELF_WITHDRAW_ENABLED==='true' && <Link href="/store/login/" className="as-header-login">내 계정</Link>}<button type="button" className="as-header-login" disabled={busy} onClick={()=>void logout()}>로그아웃</button></> : <Link href="/store/login/" className="as-header-login" onClick={saveMemberReturn}>로그인 <span className="as-header-signup">/ 회원가입</span></Link>}{error && <span role="alert">{error}</span>}</>;
}
