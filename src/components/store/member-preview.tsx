'use client';

import { EmailAuthForm, type EmailAuth, type SignupConsent } from './member-email-auth-form';
import { MemberConsentGate } from './member-consent-gate';
import { MemberConsentWithdraw } from './member-consent-withdraw';
import { MemberNaverSignIn } from './member-naver-sign-in';
import { MEMBER_INTAKE_REVIEWED, canUseMemberNaver, readMemberAuthConfig } from '@/lib/member-auth-config.mjs';
import { MEMBER_PRIVACY_VERSION, MEMBER_TERMS_VERSION } from '@/lib/member-consent.mjs';

export type MemberPreviewStage = 'default' | 'error' | 'verification' | 'authenticated' | 'consent';
const denied = async () => ({ ok: false, code: 'preview_only' });
const previewAuth: EmailAuth = { signUp: denied, signIn: denied, signOut: denied, requestPasswordReset: denied, updatePassword: denied };

/** Reuses the visitor UI without creating a client, reading a session or sending a request. */
export function MemberPreview({ mode, stage }: { mode: 'login' | 'signup'; stage: MemberPreviewStage }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const config = readMemberAuthConfig({
    enabled: process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED,
    projectRef: process.env.NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF,
    url: process.env.NEXT_PUBLIC_MEMBER_AUTH_URL,
    key: process.env.NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY,
    signup: process.env.NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED,
    naver: process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED,
    link: process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED,
  });
  const intakeEnabled = Boolean(MEMBER_INTAKE_REVIEWED && config?.signup);
  const signupConsent: SignupConsent | undefined = intakeEnabled ? {
    terms: { href: `${basePath}/terms/2026-11-23/`, version: MEMBER_TERMS_VERSION },
    privacy: { href: `${basePath}/privacy/2026-11-23/`, version: MEMBER_PRIVACY_VERSION },
    register: denied,
  } : undefined;
  const content = stage === 'consent' ?
    <MemberConsentGate basePath={basePath} accept={denied} signOut={denied} onAccepted={() => {}} /> :
    stage === 'default' && !config ? <p>회원 인증을 준비하고 있습니다.</p> :
    <section>
      <EmailAuthForm key={`${mode}-${stage}`} auth={previewAuth} signedIn={stage === 'authenticated'} initialMode={mode === 'signup' ? 'signup' : 'signin'} allowSignup={intakeEnabled} signupConsent={signupConsent} previewStatus={stage === 'error' || stage === 'verification' ? stage : undefined}/>
      {intakeEnabled && stage === 'authenticated' && <MemberConsentWithdraw withdraw={denied} onWithdrawn={() => {}} />}
      {config && canUseMemberNaver(config) && stage !== 'authenticated' && <MemberNaverSignIn basePath={basePath} busy={false} signIn={() => {}} />}
    </section>;
  return <div data-preview-stage={stage} style={{ display: 'contents' }}>{content}</div>;
}
