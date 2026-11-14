'use client';

import React, { useEffect, useState } from 'react';

type Result = { ok: boolean; code: string };
export type EmailAuth = {
  signUp(email: string, password: string): Promise<Result>;
  signIn(email: string, password: string): Promise<Result>;
  signOut(): Promise<Result>;
  requestPasswordReset(email: string): Promise<Result>;
  updatePassword(password: string): Promise<Result>;
};
type Mode = 'signup' | 'signin' | 'reset' | 'update';
// The supplied operation must persist the accepted versions on the server as
// part of the validated registration workflow. Client checks are not a security boundary.
export type SignupConsent = {
  terms: { href: string; version: string };
  privacy: { href: string; version: string };
  register: (email: string, password: string, evidence: { termsVersion: string; privacyVersion: string; termsAccepted: true; privacyAcknowledged: true }) => Promise<Result>;
};
function validNotice(notice: {href:string;version:string}) {
  return /^\/(?!\/)[A-Za-z0-9/_-]+\/$/.test(notice.href) && /^[A-Za-z0-9._-]{1,64}$/.test(notice.version);
}

export function EmailAuthForm({ auth, recovery = false, signedIn = false, initialMode = 'signin', allowSignup = false, signupConsent }: { auth: EmailAuth; recovery?: boolean; signedIn?: boolean; initialMode?: 'signin' | 'signup'; allowSignup?: boolean; signupConsent?: SignupConsent }) {
  const canSignup = Boolean(allowSignup && signupConsent && validNotice(signupConsent.terms) && validNotice(signupConsent.privacy) && typeof signupConsent.register === 'function');
  const [mode, setMode] = useState<Mode>(recovery ? 'update' : initialMode === 'signup' && !canSignup ? 'signin' : initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  useEffect(() => { if (!recovery) setMode(current => current === 'update' ? 'signin' : current); }, [recovery]);
  const clear = (next: Mode) => { setMode(next); setMessage(''); setError(''); setPassword(''); setTermsAccepted(false); setPrivacyAcknowledged(false); };
  const execute = async (fn: () => Promise<Result>) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await fn();
      const messages: Record<string, string> = {
        signup_requested: '요청을 처리했습니다. 입력한 이메일에서 인증 안내를 확인해 주세요. 발신자 이름은 키츠 인트라넷입니다.',
        signed_in: '로그인되었습니다.',
        signed_out: '로그아웃되었습니다.',
        reset_requested: '요청을 처리했습니다. 해당 계정이 있다면 이메일의 안내를 확인해 주세요. 발신자 이름은 키츠 인트라넷입니다.',
        password_updated: '비밀번호가 변경되었습니다.',
      };
      if (result.ok && messages[result.code]) { setMessage(messages[result.code]); setPassword(''); }
      else if (result.code === 'invalid_input') setError('이메일과 비밀번호를 다시 확인해 주세요.');
      else if (result.code === 'requires_confirmation') setError('이메일 인증을 완료한 뒤 다시 로그인해 주세요.');
      else if (result.code === 'sign_in_failed') setError('로그인 정보를 확인해 주세요.');
      else setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch { setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === 'signup' && canSignup && signupConsent && termsAccepted && privacyAcknowledged) return void execute(() => signupConsent.register(email.trim(), password, {termsVersion:signupConsent.terms.version,privacyVersion:signupConsent.privacy.version,termsAccepted:true,privacyAcknowledged:true}));
    if (mode === 'signup') return;
    if (mode === 'signin') return void execute(() => auth.signIn(email.trim(), password));
    if (mode === 'reset') return void execute(() => auth.requestPasswordReset(email.trim()));
    return void execute(() => auth.updatePassword(password));
  };
  const heading = { signup: '이메일 회원가입', signin: '이메일 로그인', reset: '비밀번호 재설정', update: '새 비밀번호 설정' }[mode];
  return <section aria-labelledby="auth-title">
    {!canSignup && <p role="note">회원가입은 준비 중입니다.</p>}
    <h2 id="auth-title">{heading}</h2>
    {mode === 'signup' && canSignup && <p>이메일 인증 후 로그인하면 회원 이용 안내를 다시 확인합니다.</p>}
    {signedIn && !recovery ? <button type="button" disabled={busy} onClick={() => void execute(() => auth.signOut())}>로그아웃</button> : <form onSubmit={submit}>
      {mode !== 'update' && <label>이메일<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
      {mode !== 'reset' && <label>비밀번호<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
      {mode === 'signup' && canSignup && signupConsent && <fieldset><legend>가입 안내 확인</legend><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required disabled={busy} /> <a href={signupConsent.terms.href} target="_blank" rel="noopener noreferrer">이용약관</a>에 동의합니다.</label><label><input type="checkbox" checked={privacyAcknowledged} onChange={event => setPrivacyAcknowledged(event.target.checked)} required disabled={busy} /> <a href={signupConsent.privacy.href} target="_blank" rel="noopener noreferrer">임시 개인정보 처리방침</a>을 확인했습니다.</label></fieldset>}
      <button type="submit" disabled={busy || (mode === 'signup' && (!canSignup || !termsAccepted || !privacyAcknowledged))}>{busy ? '처리 중…' : heading}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {!signedIn && !recovery && <nav aria-label="회원 인증 메뉴">
      {mode !== 'signin' && <button type="button" disabled={busy} onClick={() => clear('signin')}>로그인</button>}
      {canSignup && mode !== 'signup' && <button type="button" disabled={busy} onClick={() => clear('signup')}>회원가입</button>}
      {mode !== 'reset' && <button type="button" disabled={busy} onClick={() => clear('reset')}>비밀번호 재설정</button>}
    </nav>}
  </section>;
}
