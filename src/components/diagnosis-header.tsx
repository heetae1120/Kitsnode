"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {BrandHomeLink} from './brand-wordmark';
import {PublicCategories} from './public-categories';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';

export function DiagnosisHeader({mode,onChoose,active='profit'}:{mode?:'starter'|'player';onChoose?:()=>void;active?:'profit'|'keywords'}){
 const [signedIn,setSignedIn]=useState<boolean|null>(null);
 useEffect(()=>{
  const client=memberBrowserClient();
  if(!client){setSignedIn(false);return;}
  let active=true;
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)setSignedIn(Boolean(session?.user));});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 return <header className="ds-header"><BrandHomeLink className="ds-wordmark"/><PublicCategories active={active}/><nav className="ds-header-actions" aria-label="진단 메뉴">{mode&&<><span className="ds-mode-label">{mode==='starter'?'스타터':'플레이어'}</span><button type="button" onClick={onChoose}>유형 바꾸기 <ArrowUpRight size={16}/></button></>}<Link href="/">홈으로 <ArrowUpRight size={16}/></Link>{signedIn!==null&&<Link href="/store/login/" className="ds-header-login" onClick={signedIn?undefined:saveMemberReturn}>{signedIn?'내 계정':'로그인'}</Link>}</nav></header>;
}
