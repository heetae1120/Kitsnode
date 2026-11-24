'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronRight, FileText, LogOut, UserRound } from 'lucide-react';
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
import { MemberProfileEdit } from './member-profile-edit';
import {requestSelfWithdrawal,selfWithdrawalAvailable} from '@/lib/member-self-withdraw.mjs';
import {writeNaverIntent,readNaverIntent,clearNaverIntent,naverBoundaryEnabled,requiresNaverSignupIntent} from '@/lib/member-naver-intent.mjs';
import { MemberNaverSignIn } from './member-naver-sign-in';
import { MemberNaverError } from './member-naver-error';
import { MemberEmailProfile } from './member-email-profile';
import {createUsernameClient} from '@/lib/member-username-client.mjs';
import {createNaverAgreementBridge} from '@/lib/member-naver-agreement.mjs';

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
  const [accountUsername,setAccountUsername] = useState<string|null>(null);
  const [passwordNotice,setPasswordNotice] = useState('');
  const [passwordBusy,setPasswordBusy] = useState(false);
  const [diagnosisCount,setDiagnosisCount] = useState<number|null>(null);
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
    let active=true; setAccountName(null); setAccountUsername(null);
    if (!signedIn || !memberUserId) return () => { active=false; };
    const client=memberBrowserClient();
    if (client) void Promise.resolve(client.from('kitsnode_email_profiles').select('name,username').eq('user_id',memberUserId).maybeSingle()).then(({data})=>{if(active && memberUserIdRef.current===memberUserId){setAccountName(typeof data?.name==='string' ? data.name.trim() || null : null);setAccountUsername(typeof data?.username==='string' ? data.username : null)}}).catch(()=>{});
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
    {signedIn && !recovery && <><h2 className="member-account-title">내 계정</h2><section className="member-profile" aria-label="로그인 계정"><div className="member-profile__avatar"><UserRound size={24} aria-hidden="true"/></div><div className="member-profile__info"><h3>{accountUsername || accountName || (accountEmail ? accountEmail.split('@')[0] : '회원')}님</h3>{accountUsername && accountName && <p>{accountName}</p>}<p>{accountEmail || '이메일 정보 없음'}</p></div><span className="member-profile__status">● 로그인 중</span></section></>}
    {process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED==='true' && signedIn && !recovery && memberUserId && consentStatus==='accepted' && profileStatus==='pending' && <MemberEmailProfile key={`profile-${memberUserId}`} client={memberBrowserClient()!} userId={memberUserId} checkUsername={usernameApi?.checkUsername} onComplete={()=>{if(memberUserIdRef.current===memberUserId){setProfileCompleted(true);setProfileStatus('ready')}}}/>}
    {signedIn && !recovery && <section className="member-menu" aria-labelledby="member-activity-title"><h3 id="member-activity-title">내 활동</h3><Link className="member-menu__row" href="/store/ads/"><span className="member-menu__icon"><BarChart3 size={20} aria-hidden="true"/></span><span className="member-menu__label">광고 성과 분석</span><ChevronRight size={19} aria-hidden="true"/></Link><details className="member-menu__details"><summary className="member-menu__row"><span className="member-menu__icon"><FileText size={20} aria-hidden="true"/></span><span className="member-menu__label">내 진단서</span><span className="member-menu__meta">{diagnosisCount === null ? '' : `${diagnosisCount} / 3`}</span><ChevronRight size={19} aria-hidden="true"/></summary><div className="member-menu__expanded"><DiagnosisDownload key={memberUserId} onCountChange={setDiagnosisCount}/></div></details></section>}
    {profileCompleted && signedIn && <p role="status">회원가입이 완료되었습니다.</p>}
    {process.env.NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED==='true' && signedIn && profileStatus==='error' && <p role="alert">회원가입 완료 상태를 확인하지 못했습니다. 다시 로그인해 주세요.</p>}
    {canUseMemberNaver(config) && !signedIn && <MemberNaverSignIn basePath={basePath} busy={busy} signIn={()=>void go('signIn')}/>}
    {signedIn && !recovery && <section className="member-menu" aria-labelledby="member-settings-title"><h3 id="member-settings-title">계정 관리</h3>{memberUserId && <MemberProfileEdit key={memberUserId} userId={memberUserId} email={accountEmail} onSaved={setAccountName}/>}{accountEmail && <><button type="button" className="member-menu__row" disabled={passwordBusy} onClick={()=>{setPasswordNotice('');setPasswordBusy(true);void api.requestPasswordReset(accountEmail).then(result=>setPasswordNotice(result.ok?'비밀번호 변경 안내를 이메일로 요청했습니다. 받은 메일을 확인해 주세요.':'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')).catch(()=>setPasswordNotice('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')).finally(()=>setPasswordBusy(false))}}><span className="member-menu__icon" aria-hidden="true">🔒</span><span className="member-menu__label">비밀번호 변경 메일 받기</span><ChevronRight size={19} aria-hidden="true"/></button>{passwordNotice && <p role="status">{passwordNotice}</p>}</>}{canUseMemberNaver(config) && config.link && naverIdentity.canLinkEmail && !naverIdentity.linked && <button type="button" className="member-menu__row" disabled={busy} onClick={()=>void go('link')}><span className="member-menu__icon member-menu__icon--naver">N</span><span className="member-menu__label">네이버 계정 연결</span><ChevronRight size={19} aria-hidden="true"/></button>}{canUseMemberNaver(config) && config.link && naverIdentity.linked && <div className="member-menu__row"><span className="member-menu__icon member-menu__icon--naver">N</span><span className="member-menu__label">네이버 계정</span><span className="member-menu__meta">연결됨</span></div>}<button type="button" className="member-menu__row" onClick={()=>{setSignOutError('');void api.signOut().then(result=>{if(!result.ok)setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.')}).catch(()=>setSignOutError('로그아웃하지 못했습니다. 다시 시도해 주세요.'))}}><span className="member-menu__icon"><LogOut size={20} aria-hidden="true"/></span><span className="member-menu__label">로그아웃</span><ChevronRight size={19} aria-hidden="true"/></button>{signOutError && <p role="alert">{signOutError}</p>}{withdrawAvailable && memberUserId && <MemberSelfWithdraw key={memberUserId} withdraw={()=>requestSelfWithdrawal(memberBrowserClient(),memberUserId,()=>setWithdrawCompleted(true))}/>}</section>}
    {error && <MemberNaverError message={error} conflict={error===naverErrorText.identity_conflict} signupRequired={error===naverErrorText.signup_required} basePath={basePath}/>}
  </section>;
}
