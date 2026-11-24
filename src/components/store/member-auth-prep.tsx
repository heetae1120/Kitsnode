'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, UserRound } from 'lucide-react';
import {memberBrowserClient,takeNaverProviderCallback} from '@/lib/member-browser-client';
import {takeMemberReturn} from '@/lib/member-return';
import { MEMBER_INTAKE_REVIEWED, canUseMemberNaver, readMemberAuthConfig, memberRedirect } from '@/lib/member-auth-config.mjs';
import { createEmailAuthClient } from '@/lib/member-email-auth.mjs';
import { createNaverAuth, naverIdentityState, oauthCallbackError } from '@/lib/member-naver-auth.mjs';
import { bindConsentToUser, createMemberConsent, MEMBER_PRIVACY_VERSION, MEMBER_TERMS_VERSION } from '@/lib/member-consent.mjs';
import { EmailAuthForm, type EmailAuth, type SignupDraft } from './member-email-auth-form';
import { MemberConsentGate } from './member-consent-gate';
import { DiagnosisDownload } from '../diagnosis-download';
import { MemberSelfWithdraw } from './member-self-withdraw';
import {requestSelfWithdrawal,selfWithdrawalAvailable} from '@/lib/member-self-withdraw.mjs';
import {writeNaverIntent,readNaverIntent,clearNaverIntent,naverBoundaryEnabled,requiresNaverSignupIntent} from '@/lib/member-naver-intent.mjs';
import { MemberNaverSignIn } from './member-naver-sign-in';
import { MemberNaverError } from './member-naver-error';
import { MemberEmailProfile } from './member-email-profile';
import {createUsernameClient} from '@/lib/member-username-client.mjs';
import {createNaverAgreementBridge} from '@/lib/member-naver-agreement.mjs';
import naverStyles from './naver-login.module.css';

const naverErrorText: Record<string,string> = {
  identity_conflict:'이미 다른 계정에 연결된 네이버 계정입니다. 기존 연결을 확인해 주세요.',
  already_linked:'이미 네이버 계정이 연결되어 있습니다.',
  unauthenticated:'이메일 인증을 완료한 계정으로 로그인한 뒤 연결해 주세요.',
  cancelled:'네이버 인증이 취소되었습니다. 다시 시도할 수 있습니다.',
  unavailable:'네이버 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  signup_required:'가입된 키츠노드 회원이 아닙니다. 회원가입 화면에서 네이버로 가입해 주세요.',
};
const naverStorage=()=>{try{return window.sessionStorage}catch{return null}};

export function MemberAuthPrep({mode}:{mode:'login'|'signup'}) {
  const [api,setApi] = useState<EmailAuth|null>(null);
  const [usernameApi,setUsernameApi]=useState<ReturnType<typeof createUsernameClient>|null>(null);
  const [social,setSocial] = useState<ReturnType<typeof createNaverAuth>|null>(null);
  const [consent,setConsent] = useState<ReturnType<typeof createMemberConsent>|null>(null);
  const consentUserRef = useRef<string|null>(null);
  const [consentStatus,setConsentStatus] = useState<'checking'|'needed'|'accepted'|'error'>('checking');
  const [signedIn,setSignedIn] = useState(false);
  const [accountEmail,setAccountEmail] = useState<string|null>(null);
  const [accountName,setAccountName] = useState<string|null>(null);
  const [signOutError,setSignOutError] = useState('');
  const [naverIdentity,setNaverIdentity] = useState({linked:false,canLinkEmail:false});
  const [profileStatus,setProfileStatus]=useState<'checking'|'pending'|'ready'|'error'>('checking');
  const [profileCompleted,setProfileCompleted]=useState(false);
  const [recovery,setRecovery] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  const memberUserIdRef = useRef<string|null>(null);
  const [memberUserId,setMemberUserId] = useState<string|null>(null);
  const [withdrawAvailable,setWithdrawAvailable] = useState(false);
  const [naverBoundary,setNaverBoundary] = useState(false);
  const [naverAgreementPending,setNaverAgreementPending] = useState(false);
  const [consentRefresh,setConsentRefresh] = useState(0);
  const [withdrawCompleted,setWithdrawCompleted] = useState(false);
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
    setNaverBoundary(naverBoundaryEnabled(naverStorage(),process.env.NEXT_PUBLIC_NAVER_SIGNUP_BOUNDARY,window.location.search));
    if (!config || window.location.protocol !== 'https:') return;
    const redirectTo = memberRedirect(window.location.origin,process.env.NEXT_PUBLIC_BASE_PATH || '');
    if (!redirectTo) return;
    const callbackError=oauthCallbackError(window.location.href);
    if (callbackError) {
      setError(naverErrorText[callbackError]);
      clearNaverIntent(naverStorage());
      window.history.replaceState(null,'',window.location.pathname);
    }
    const current = memberBrowserClient();
    if (!current) return;
    const usernameClient=process.env.NEXT_PUBLIC_MEMBER_USERNAME_ENABLED==='true'?createUsernameClient({url:config.url,key:config.key,auth:current.auth}):null;
    setUsernameApi(usernameClient);
    const email = createEmailAuthClient({auth:current.auth,trustedOrigin:window.location.origin,confirmationRedirectTo:redirectTo,recoveryRedirectTo:redirectTo,signupAllowed:MEMBER_INTAKE_REVIEWED && config.signup});
    // The Naver button must not outlive the member consent gate. These are UI
    // flags only; database authorisation remains a separate security boundary.
    const socialEnabled=canUseMemberNaver(config);
    const naver = createNaverAuth({auth:current.auth,trustedOrigin:window.location.origin,redirectTo,allowSignIn:socialEnabled,allowLink:socialEnabled && config.link});
    const naverAgreement=createNaverAgreementBridge({enabled:socialEnabled&&process.env.NEXT_PUBLIC_NAVER_AGREEMENT_ENABLED==='true',url:config.url,key:config.key});
    let active=true, agreementAttempted=false, agreementEpoch=0, agreementAccess:string|null=null;
    const {data:{subscription}} = current.auth.onAuthStateChange((event,session) => {
      const nextId=session?.user?.id || null;
      const nextAccess=session?.access_token || null;
      if(agreementAccess!==nextAccess){agreementAccess=nextAccess;agreementEpoch++;naverAgreement.cancel();agreementAttempted=false;setNaverAgreementPending(false);}
      if (memberUserIdRef.current !== nextId) { agreementEpoch++;naverAgreement.cancel();agreementAttempted=false;setNaverAgreementPending(false);memberUserIdRef.current=nextId; consentUserRef.current=null; setConsentStatus('checking'); setProfileStatus('checking'); setProfileCompleted(false); setMemberUserId(nextId); }
      setSignedIn(Boolean(session?.user));
      setAccountEmail(session?.user?.email || null);
      setNaverIdentity(naverIdentityState(session?.user));
      const callbackToken=(event==='SIGNED_IN'||event==='INITIAL_SESSION')?takeNaverProviderCallback(session):null;
      const providerToken=session?.provider_token || callbackToken;
      if(socialEnabled&&process.env.NEXT_PUBLIC_NAVER_AGREEMENT_ENABLED==='true'&&!agreementAttempted&&nextId&&session&&providerToken&&naverIdentityState(session.user).linked&&(event==='SIGNED_IN'||event==='INITIAL_SESSION')){
        agreementAttempted=true;const epoch=agreementEpoch;setNaverAgreementPending(true);
        // Do not await within Supabase's auth callback; the SDK may hold its lock.
        setTimeout(()=>{if(!active||epoch!==agreementEpoch||memberUserIdRef.current!==nextId)return;void naverAgreement.verify({...session,provider_token:providerToken}).then(ok=>{if(active&&epoch===agreementEpoch&&memberUserIdRef.current===nextId){if(ok)setConsentRefresh(n=>n+1);setNaverAgreementPending(false)}}).catch(()=>{if(active&&epoch===agreementEpoch&&memberUserIdRef.current===nextId)setNaverAgreementPending(false)})},0);
      }
      if(event === 'PASSWORD_RECOVERY') setRecovery(true);
      if(event === 'SIGNED_OUT') setRecovery(false);
    });
    setApi({...email,updatePassword:async password=>{const result=await email.updatePassword(password);if(result.ok)setRecovery(false);return result;}});
    setConsent(createMemberConsent(current));
    setSocial(naver);
    return () => { active=false;agreementEpoch++;naverAgreement.dispose();subscription.unsubscribe(); email.dispose(); usernameClient?.dispose(); };
  // Configuration is build-time only and does not change in this component's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(() => {
    if (!MEMBER_INTAKE_REVIEWED || !config?.signup || !signedIn || recovery || !consent || naverAgreementPending) return;
    let active=true;
    const checkedUserId=memberUserId;
    consentUserRef.current=null;
    setConsentStatus('checking');
    void consent.hasCurrent().then(async result => {
      if (active && checkedUserId && memberUserIdRef.current===checkedUserId) {
        if(result.ok && !result.accepted && requiresNaverSignupIntent(naverBoundary,naverIdentity.linked,readNaverIntent(naverStorage()))){
          const history=await consent.hasAny();
          if(!active || memberUserIdRef.current!==checkedUserId)return;
          if(!history.ok){setConsentStatus('error');return;}
          if(!history.accepted){
            clearNaverIntent(naverStorage());setConsentStatus('error');setError(naverErrorText.signup_required);
            try{await memberBrowserClient()?.auth.signOut({scope:'local'});}catch{}return;
          }
          clearNaverIntent(naverStorage());
        }
        if(result.ok && result.accepted)clearNaverIntent(naverStorage());
        consentUserRef.current=result.ok && result.accepted ? checkedUserId : null; setConsentStatus(!result.ok ? 'error' : result.accepted ? 'accepted' : 'needed');
      }
    }).catch(()=>{if(active && checkedUserId && memberUserIdRef.current===checkedUserId)setConsentStatus('error');});
    return ()=>{active=false;};
  },[signedIn,memberUserId,recovery,consent,config?.signup,naverBoundary,naverIdentity.linked,naverAgreementPending,consentRefresh]);
  useEffect(() => {
    let active=true;
    if(process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED!=='true'||!signedIn||recovery||!memberUserId){setProfileStatus('ready');return ()=>{active=false};}
    const current=memberBrowserClient();setProfileStatus('checking');
    if(!current){setProfileStatus('error');return ()=>{active=false};}
    void Promise.resolve(current.rpc('kitsnode_my_email_profile_pending')).then(({data,error})=>{if(active&&memberUserIdRef.current===memberUserId)setProfileStatus(error||typeof data!=='boolean'?'error':data?'pending':'ready')}).catch(()=>{if(active)setProfileStatus('error')});
    return ()=>{active=false};
  },[signedIn,recovery,memberUserId]);
  useEffect(() => {
    let active=true; setAccountName(null);
    if (!signedIn || !memberUserId) return () => { active=false; };
    const client=memberBrowserClient();
    if (client) void Promise.resolve(client.from('kitsnode_email_profiles').select('name').eq('user_id',memberUserId).maybeSingle()).then(({data})=>{if(active && memberUserIdRef.current===memberUserId && typeof data?.name==='string')setAccountName(data.name.trim() || null)}).catch(()=>{});
    return () => { active=false; };
  },[signedIn,memberUserId,profileCompleted]);
  useEffect(() => {
    if (!signedIn || recovery || !config?.signup || consentStatus !== 'accepted' || !memberUserId || consentUserRef.current !== memberUserId || memberUserIdRef.current !== memberUserId) return;
    if(process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED==='true'&&profileStatus!=='ready')return;
    const target = takeMemberReturn();
    if (target) window.location.assign(target);
  },[signedIn,recovery,consentStatus,memberUserId,config?.signup,profileStatus]);
  useEffect(() => {
    let active=true;
    setWithdrawAvailable(false);
    if(process.env.NEXT_PUBLIC_SELF_WITHDRAW_ENABLED==='true' && signedIn && !recovery && memberUserId){
      void selfWithdrawalAvailable(memberBrowserClient(),memberUserId).then(available=>{if(active && memberUserIdRef.current===memberUserId)setWithdrawAvailable(available)});
    }
    return ()=>{active=false};
  },[signedIn,recovery,memberUserId]);
  if (!config || !api || !social) return <p>회원 인증을 준비하고 있습니다.</p>;
  const intakeEnabled=MEMBER_INTAKE_REVIEWED && config.signup;
  const basePath=process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (intakeEnabled && signedIn && !recovery && consent) {
    if (naverAgreementPending) return <p role="status">회원 이용 안내 확인 중입니다.</p>;
    if (consentStatus === 'checking') return <p role="status">회원 이용 안내 확인 중입니다.</p>;
    if (consentStatus === 'error') return <section><p role="alert">회원 이용 안내를 확인하지 못했습니다. 잠시 후 다시 로그인해 주세요.</p><button type="button" onClick={()=>void api.signOut()}>로그아웃</button></section>;
    if (consentStatus === 'needed' && memberUserId) {
      const consentUserId=memberUserId;
      return <><MemberConsentGate key={consentUserId} basePath={basePath} accept={bindConsentToUser(consent,consentUserId,()=>memberUserIdRef.current)} signOut={api.signOut} onAccepted={()=>{if(memberUserIdRef.current===consentUserId){clearNaverIntent(naverStorage());consentUserRef.current=consentUserId;setConsentStatus('accepted');}}}/>{withdrawAvailable && <MemberSelfWithdraw key={`withdraw-${consentUserId}`} withdraw={()=>requestSelfWithdrawal(memberBrowserClient(),consentUserId,()=>setWithdrawCompleted(true))}/>}</>;
    }
    if (consentStatus !== 'accepted') return <p role="alert">회원 이용 안내를 확인하지 못했습니다. 다시 로그인해 주세요.</p>;
  }
  const signupConsent=intakeEnabled ? {
    terms:{href:`${basePath}/terms/2026-11-23/`,version:MEMBER_TERMS_VERSION},
    privacy:{href:`${basePath}/privacy/2026-11-23/`,version:MEMBER_PRIVACY_VERSION},
    register:async (email:string,password:string,evidence:{termsVersion:string;privacyVersion:string;termsAccepted:true;privacyAcknowledged:true},draft:SignupDraft) => {
      if(evidence.termsAccepted!==true || evidence.privacyAcknowledged!==true || evidence.termsVersion!==MEMBER_TERMS_VERSION || evidence.privacyVersion!==MEMBER_PRIVACY_VERSION) return {ok:false,code:'invalid_input'};
      return api.signUp(email,password,evidence,draft);
    },
  } : undefined;
  const go = async (action:'signIn'|'link') => { if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try {if(action==='signIn'&&naverBoundary&&!writeNaverIntent(naverStorage(),mode==='signup'?'signup':'signin')){setError(naverErrorText.unavailable);return;}const result=await social[action]();if(!result.ok){clearNaverIntent(naverStorage());setError(naverErrorText[result.code] || naverErrorText.unavailable);}} finally {busyRef.current=false;setBusy(false);} };
  return <section className={signedIn && !recovery ? "member-signed-in" : undefined}>
    {withdrawCompleted && <p role="status">회원 탈퇴가 완료되었습니다. 다시 이용하려면 회원가입해 주세요.</p>}
    {(!signedIn || recovery) && <EmailAuthForm key={recovery?'recovery':'normal'} auth={api} signedIn={signedIn} recovery={recovery} initialMode={mode==='signup'?'signup':'signin'} allowSignup={intakeEnabled} signupConsent={signupConsent} usernameSignIn={usernameApi?.signIn} resumeSignup={usernameApi?.resumeSignup} checkUsername={usernameApi?.checkUsername}/>}
    {signedIn && !recovery && <section className="member-welcome" aria-label="로그인 계정"><div className="member-welcome__icon"><UserRound size={24} aria-hidden="true"/></div><div className="member-welcome__content"><h2>안녕하세요, {accountName || (accountEmail ? accountEmail.split('@')[0] : '회원')}님 👋</h2><p className="member-welcome__status">● 로그인 중</p><p className="member-welcome__email">{accountEmail || '이메일 정보 없음'}</p><button type="button" onClick={()=>{setSignOutError('');void api.signOut().then(result=>{if(!result.ok)setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.')}).catch(()=>setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.'))}}>로그아웃</button>{signOutError && <p role="alert">{signOutError}</p>}</div></section>}
    {process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED==='true' && signedIn && !recovery && memberUserId && consentStatus==='accepted' && profileStatus==='pending' && <MemberEmailProfile key={`profile-${memberUserId}`} client={memberBrowserClient()!} userId={memberUserId} checkUsername={usernameApi?.checkUsername} onComplete={()=>{if(memberUserIdRef.current===memberUserId){setProfileCompleted(true);setProfileStatus('ready')}}}/>}
    {signedIn && !recovery && <><section className="member-ads-entry" aria-labelledby="signed-in-ads-title"><div className="member-ads-entry__icon"><BarChart3 size={24} aria-hidden="true" /></div><div className="member-ads-entry__content"><h2 id="signed-in-ads-title">광고 성과 분석</h2><p>광고 성과를 확인하고 개선점을 찾아보세요.</p><Link className="member-ads-entry__link" href="/store/ads/">분석 시작하기 <ArrowRight size={17} aria-hidden="true" /></Link></div></section></>}
    {profileCompleted && signedIn && <p role="status">회원가입이 완료되었습니다.</p>}
    {process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED==='true' && signedIn && profileStatus==='error' && <p role="alert">회원가입 완료 상태를 확인하지 못했습니다. 다시 로그인해 주세요.</p>}
    {withdrawAvailable && signedIn && !recovery && memberUserId && <MemberSelfWithdraw key={memberUserId} withdraw={()=>requestSelfWithdrawal(memberBrowserClient(),memberUserId,()=>setWithdrawCompleted(true))}/>}
    {canUseMemberNaver(config) && !signedIn && <MemberNaverSignIn basePath={basePath} busy={busy} signIn={()=>void go('signIn')}/>}
    {canUseMemberNaver(config) && config.link && signedIn && !recovery && naverIdentity.canLinkEmail && !naverIdentity.linked && <section className="member-naver-card"><h2>연결된 계정</h2><button type="button" className={naverStyles.linkButton} disabled={busy} onClick={()=>void go('link')}><img src={`${basePath}/naver-login/icon.png`} alt="" width="48" height="48" /><span>네이버 계정 연결</span></button><p>현재 이메일 계정에 네이버 계정을 연결합니다.</p></section>}
    {canUseMemberNaver(config) && config.link && signedIn && !recovery && naverIdentity.linked && <section className="member-naver-card"><h2>연결된 계정</h2><p>네이버 계정이 연결되어 있습니다.</p></section>}
    {signedIn && !recovery && <section className="member-diagnoses" aria-label="내 진단서"><DiagnosisDownload key={memberUserId}/></section>}
    {error && <MemberNaverError message={error} conflict={error===naverErrorText.identity_conflict} signupRequired={error===naverErrorText.signup_required} basePath={basePath}/>}
  </section>;
}
