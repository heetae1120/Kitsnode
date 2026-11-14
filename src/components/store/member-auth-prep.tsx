'use client';
import React, { useEffect, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MEMBER_INTAKE_REVIEWED, readMemberAuthConfig, memberRedirect } from '@/lib/member-auth-config.mjs';
import { createEmailAuthClient } from '@/lib/member-email-auth.mjs';
import { createNaverAuth } from '@/lib/member-naver-auth.mjs';
import { bindConsentToUser, createMemberConsent, MEMBER_PRIVACY_VERSION, MEMBER_TERMS_VERSION } from '@/lib/member-consent.mjs';
import { EmailAuthForm, type EmailAuth } from './member-email-auth-form';
import { MemberConsentGate } from './member-consent-gate';
import { MemberConsentWithdraw } from './member-consent-withdraw';

let client: SupabaseClient | null = null;

export function MemberAuthPrep({mode}:{mode:'login'|'signup'}) {
  const [api,setApi] = useState<EmailAuth|null>(null);
  const [social,setSocial] = useState<ReturnType<typeof createNaverAuth>|null>(null);
  const [consent,setConsent] = useState<ReturnType<typeof createMemberConsent>|null>(null);
  const [consentStatus,setConsentStatus] = useState<'checking'|'needed'|'accepted'|'error'>('checking');
  const [signedIn,setSignedIn] = useState(false);
  const [recovery,setRecovery] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  const memberUserIdRef = useRef<string|null>(null);
  const [memberUserId,setMemberUserId] = useState<string|null>(null);
  const config = readMemberAuthConfig({
    enabled:process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED,
    projectRef:process.env.NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF,
    url:process.env.NEXT_PUBLIC_MEMBER_AUTH_URL,
    key:process.env.NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY,
    signup:process.env.NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED,
    naver:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED,
    link:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED,
  });
  useEffect(() => {
    if (!config || window.location.protocol !== 'https:') return;
    const redirectTo = memberRedirect(window.location.origin,process.env.NEXT_PUBLIC_BASE_PATH || '');
    if (!redirectTo) return;
    const current = client ?? createClient(config.url,config.key);
    client = current;
    const email = createEmailAuthClient({auth:current.auth,trustedOrigin:window.location.origin,confirmationRedirectTo:redirectTo,recoveryRedirectTo:redirectTo,signupAllowed:MEMBER_INTAKE_REVIEWED && config.signup});
    const naver = createNaverAuth({auth:current.auth,trustedOrigin:window.location.origin,redirectTo,allowSignIn:MEMBER_INTAKE_REVIEWED && config.naver,allowLink:config.link});
    const {data:{subscription}} = current.auth.onAuthStateChange((event,session) => {
      const nextId=session?.user?.id || null;
      if (memberUserIdRef.current !== nextId) { memberUserIdRef.current=nextId; setConsentStatus('checking'); setMemberUserId(nextId); }
      setSignedIn(Boolean(session?.user));
      if(event === 'PASSWORD_RECOVERY') setRecovery(true);
      if(event === 'SIGNED_OUT') setRecovery(false);
    });
    setApi({...email,updatePassword:async password=>{const result=await email.updatePassword(password);if(result.ok)setRecovery(false);return result;}});
    setConsent(createMemberConsent(current));
    setSocial(naver);
    return () => { subscription.unsubscribe(); email.dispose(); };
  // Configuration is build-time only and does not change in this component's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(() => {
    if (!MEMBER_INTAKE_REVIEWED || !config?.signup || !signedIn || recovery || !consent) return;
    let active=true;
    setConsentStatus('checking');
    void consent.hasCurrent().then(result => {
      if (active) setConsentStatus(!result.ok ? 'error' : result.accepted ? 'accepted' : 'needed');
    }).catch(()=>{if(active)setConsentStatus('error');});
    return ()=>{active=false;};
  },[signedIn,memberUserId,recovery,consent,config?.signup]);
  if (!config || !api || !social) return <p>회원 인증을 준비하고 있습니다.</p>;
  const intakeEnabled=MEMBER_INTAKE_REVIEWED && config.signup;
  const basePath=process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (intakeEnabled && signedIn && !recovery && consent) {
    if (consentStatus === 'checking') return <p role="status">회원 이용 안내 확인 중입니다.</p>;
    if (consentStatus === 'error') return <section><p role="alert">회원 이용 안내를 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.</p><button type="button" onClick={()=>void api.signOut()}>로그아웃</button></section>;
    if (consentStatus === 'needed' && memberUserId) {
      const consentUserId=memberUserId;
      return <MemberConsentGate key={consentUserId} basePath={basePath} accept={bindConsentToUser(consent,consentUserId,()=>memberUserIdRef.current)} signOut={api.signOut} onAccepted={()=>{if(memberUserIdRef.current===consentUserId)setConsentStatus('accepted');}}/>;
    }
    if (consentStatus !== 'accepted') return <p role="alert">회원 이용 안내를 확인하지 못했습니다. 다시 로그인해 주세요.</p>;
  }
  const signupConsent=intakeEnabled ? {
    terms:{href:`${basePath}/terms/`,version:MEMBER_TERMS_VERSION},
    privacy:{href:`${basePath}/privacy/`,version:MEMBER_PRIVACY_VERSION},
    register:async (email:string,password:string,evidence:{termsVersion:string;privacyVersion:string;termsAccepted:true;privacyAcknowledged:true}) => {
      if(evidence.termsAccepted!==true || evidence.privacyAcknowledged!==true || evidence.termsVersion!==MEMBER_TERMS_VERSION || evidence.privacyVersion!==MEMBER_PRIVACY_VERSION) return {ok:false,code:'invalid_input'};
      return api.signUp(email,password);
    },
  } : undefined;
  const go = async (action:'signIn'|'link') => { if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try {const result=await social[action]();if(!result.ok)setError('네이버 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');} finally {busyRef.current=false;setBusy(false);} };
  return <section>
    <EmailAuthForm key={recovery?'recovery':'normal'} auth={api} signedIn={signedIn} recovery={recovery} initialMode={mode==='signup'?'signup':'signin'} allowSignup={intakeEnabled} signupConsent={signupConsent}/>
    {intakeEnabled && signedIn && !recovery && consent && memberUserId && consentStatus==='accepted' && <MemberConsentWithdraw key={memberUserId} withdraw={async()=>{
      const id=memberUserId;
      if(memberUserIdRef.current!==id)return {ok:false};
      const result=await consent.withdraw(id);
      return memberUserIdRef.current===id ? result : {ok:false};
    }} onWithdrawn={()=>{if(memberUserIdRef.current===memberUserId)setConsentStatus('needed');}}/>}
    {MEMBER_INTAKE_REVIEWED && config.naver && !signedIn && <button type="button" disabled={busy} onClick={()=>void go('signIn')}>네이버로 로그인</button>}
    {config.link && signedIn && !recovery && <button type="button" disabled={busy} onClick={()=>void go('link')}>네이버 계정 연결</button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
