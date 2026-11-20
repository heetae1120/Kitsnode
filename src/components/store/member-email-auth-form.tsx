'use client';

import React, { useEffect, useRef, useState } from 'react';

type Result = { ok: boolean; code: string };
export type EmailAuth = {
  signUp(email: string, password: string, evidence: {termsVersion:string;privacyVersion:string;termsAccepted:true;privacyAcknowledged:true}): Promise<Result>;
  signIn(email: string, password: string): Promise<Result>;
  signOut(): Promise<Result>;
  requestPasswordReset(email: string): Promise<Result>;
  updatePassword(password: string): Promise<Result>;
};
type Mode = 'signup' | 'signin' | 'reset' | 'update';
export type SignupConsent = {
  terms: { href: string; version: string };
  privacy: { href: string; version: string };
  // Kept for compatibility with the existing preview and email flow. It is
  // deliberately not used for the extended signup flow.
  register: (email: string, password: string, evidence: { termsVersion: string; privacyVersion: string; termsAccepted: true; privacyAcknowledged: true }) => Promise<Result>;
};
export type ExtendedSignup = {
  checkUsername(username: string): Promise<Result>;
  register(input: {name:string;username:string;password:string;passwordConfirmation:string;email:string;phone:string;termsAccepted:true;privacyAccepted:true;ageConfirmed:true;termsVersion:string;privacyVersion:string}): Promise<Result>;
};
function validNotice(notice: {href:string;version:string}) {
  return /^\/(?!\/)[A-Za-z0-9/_-]+\/$/.test(notice.href) && /^[A-Za-z0-9._-]{1,64}$/.test(notice.version);
}
const normalizeUsername = (value:string) => value.trim().toLowerCase();
const usernameValid = (value:string) => /^[a-z0-9][a-z0-9_-]{3,19}$/.test(value);

export function EmailAuthForm({ auth, recovery = false, signedIn = false, initialMode = 'signin', allowSignup = false, signupConsent, signupVariant = 'legacy', extendedSignup, signinVariant = 'email', usernameSignIn, previewStatus }: { auth: EmailAuth; recovery?: boolean; signedIn?: boolean; initialMode?: 'signin' | 'signup'; allowSignup?: boolean; signupConsent?: SignupConsent; signupVariant?: 'legacy' | 'extended'; extendedSignup?: ExtendedSignup; signinVariant?: 'email' | 'username'; usernameSignIn?: (username: string, password: string) => Promise<Result>; previewStatus?: 'error' | 'verification' }) {
  // Extended signup is opt-in and never falls back to the legacy operation.
  // Existing consumers retain the original email-only signup behavior.
  const extended = signupVariant === 'extended';
  const consentReady = Boolean(allowSignup && signupConsent && validNotice(signupConsent.terms) && validNotice(signupConsent.privacy));
  const canSignup = Boolean(consentReady && (extended ? extendedSignup && typeof extendedSignup.checkUsername === 'function' && typeof extendedSignup.register === 'function' : signupConsent && typeof signupConsent.register === 'function'));
  const [mode, setMode] = useState<Mode>(recovery ? 'update' : initialMode === 'signup' && !canSignup ? 'signin' : initialMode);
  const [email, setEmail] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'username'>(signinVariant);
  const [loginUsername, setLoginUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phone, setPhone] = useState('');
  const [usernameState, setUsernameState] = useState<'idle'|'checking'|'available'|'unavailable'|'error'>('idle');
  const [checkedUsername, setCheckedUsername] = useState('');
  const usernameRequest = useRef(0);
  const [message, setMessage] = useState(previewStatus === 'verification' ? '요청을 처리했습니다. 입력한 이메일에서 인증 안내를 확인해 주세요.' : '');
  const [error, setError] = useState(previewStatus === 'error' ? '로그인 정보를 확인해 주세요.' : '');
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  useEffect(() => { if (!recovery) setMode(current => current === 'update' ? 'signin' : current); }, [recovery]);
  useEffect(() => () => { usernameRequest.current += 1; }, []);
  const clear = (next: Mode) => { usernameRequest.current += 1; setMode(next); setMessage(''); setError(''); setPassword(''); setConfirmation(''); setUsernameState('idle'); setCheckedUsername(''); setTermsAccepted(false); setPrivacyAcknowledged(false); setAgeConfirmed(false); };
  const checkUsername = async () => {
    if (!extendedSignup || busy || usernameState === 'checking') return;
    const candidate = normalizeUsername(username);
    if (!usernameValid(candidate)) { setUsernameState('error'); setCheckedUsername(''); return; }
    const request = ++usernameRequest.current;
    setUsernameState('checking'); setCheckedUsername('');
    try {
      const result = await extendedSignup.checkUsername(candidate);
      if (request !== usernameRequest.current) return;
      if (result.ok && result.code === 'available') { setCheckedUsername(candidate); setUsernameState('available'); }
      else if (result.ok && result.code === 'unavailable') setUsernameState('unavailable');
      else setUsernameState('error');
    } catch { if (request === usernameRequest.current) setUsernameState('error'); }
  };
  const execute = async (fn: () => Promise<Result>) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await fn();
      const messages: Record<string, string> = {
        signup_requested: '요청을 처리했습니다. 인증 메일을 확인해 주세요. 이미 가입한 계정이라면 로그인하거나 비밀번호를 재설정해 주세요.',
        signup_requested_manual: '요청을 처리했습니다. 인증 메일을 확인해 주세요. 인증 후 회원 정보를 다시 입력해야 할 수 있습니다.',
        signed_in: '로그인되었습니다.', signed_out: '로그아웃되었습니다.',
        reset_requested: '요청을 처리했습니다. 해당 계정이 있다면 이메일의 안내를 확인해 주세요.', password_updated: '비밀번호가 변경되었습니다.',
      };
      if (result.ok && messages[result.code]) { setMessage(messages[result.code]); setPassword(''); setConfirmation(''); }
      else if (result.code === 'username_taken') { setCheckedUsername(''); setUsernameState('unavailable'); setError('이미 사용 중인 아이디입니다.'); }
      else if (result.code === 'email_rate_limited') setError('요청이 너무 잦습니다. 잠시 기다린 뒤 다시 시도해 주세요.');
      else if (result.code === 'invalid_input') setError('입력 정보를 다시 확인해 주세요.');
      else if (result.code === 'requires_confirmation') setError('이메일 인증을 완료한 뒤 다시 로그인해 주세요.');
      else if (result.code === 'sign_in_failed') setError('로그인 정보를 확인해 주세요.');
      else setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch { setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === 'signup') {
      if (!canSignup || !signupConsent || !termsAccepted || !privacyAcknowledged) return;
      if (!extended) return void execute(() => signupConsent.register(email.trim(), password, {termsVersion:signupConsent.terms.version,privacyVersion:signupConsent.privacy.version,termsAccepted:true,privacyAcknowledged:true}));
      if (!extendedSignup || !ageConfirmed) return;
      const normalized = normalizeUsername(username);
      if (!usernameValid(normalized) || checkedUsername !== normalized || usernameState !== 'available') { setError('아이디 중복 확인을 해 주세요.'); return; }
      if (!name.trim() || name.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(name.trim())) { setError('이름을 확인해 주세요.'); return; }
      if (password.length < 8 || password.length > 72 || password !== confirmation) { setError('비밀번호와 비밀번호 확인을 확인해 주세요.'); return; }
      if (!/^[0-9 -]+$/.test(phone) || !/^01[016789][0-9]{7,8}$/.test(phone.replace(/[ -]/g, ''))) { setError('휴대폰 번호를 확인해 주세요.'); return; }
      return void execute(() => extendedSignup.register({name:name.trim(),username:normalized,password,passwordConfirmation:confirmation,email:email.trim(),phone:phone.trim(),termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:signupConsent.terms.version,privacyVersion:signupConsent.privacy.version}));
    }
    if (mode === 'signin') {
      if (loginMethod === 'email') return void execute(() => auth.signIn(email.trim(), password));
      if (typeof usernameSignIn !== 'function') return;
      const normalized = normalizeUsername(loginUsername);
      if (!usernameValid(normalized)) { setError('아이디를 확인해 주세요.'); return; }
      return void execute(() => usernameSignIn(normalized, password));
    }
    if (mode === 'reset') return void execute(() => auth.requestPasswordReset(email.trim()));
    return void execute(() => auth.updatePassword(password));
  };
  const heading = { signup: extended ? '일반 회원가입' : '이메일 회원가입', signin: loginMethod === 'username' ? '아이디 로그인' : '이메일 로그인', reset: '비밀번호 재설정', update: '새 비밀번호 설정' }[mode];
  const usernameMessage = {idle:'영문 소문자, 숫자, 밑줄, 하이픈 4~20자를 사용해 주세요.',checking:'아이디를 확인하고 있습니다.',available:'사용 가능한 아이디입니다.',unavailable:'이미 사용 중인 아이디입니다.',error:'아이디 형식을 확인하거나 잠시 후 다시 시도해 주세요.'}[usernameState];
  return <section aria-labelledby="auth-title">
    {!canSignup && <p role="note">회원가입은 준비 중입니다.</p>}
    <h2 id="auth-title">{heading}</h2>
    {mode === 'reset' && <p>가입한 이메일을 입력하고 아래 버튼을 누르면 재설정 안내를 보내드립니다.</p>}
    {mode === 'signup' && <p>가입 시 이용약관과 개인정보 수집 및 이용을 확인해 주세요.</p>}
    {signedIn && !recovery ? <button type="button" disabled={busy} onClick={() => void execute(() => auth.signOut())}>로그아웃</button> : <form onSubmit={submit}>
      {mode === 'signup' && extended && <><label>이름<input type="text" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
        <label>아이디<input type="text" autoComplete="username" required minLength={4} maxLength={20} value={username} aria-describedby="signup-username-status" onChange={event => {usernameRequest.current += 1; setUsername(event.target.value); setCheckedUsername(''); setUsernameState('idle');}} disabled={busy} /></label>
        <button type="button" onClick={() => void checkUsername()} disabled={busy || usernameState === 'checking'}>아이디 중복 확인</button><p id="signup-username-status" role="status">{usernameMessage}</p></>}
      {mode === 'signin' && loginMethod === 'username' && <label>아이디<input type="text" autoComplete="username" required minLength={4} maxLength={20} value={loginUsername} onChange={event => setLoginUsername(event.target.value)} disabled={busy} /></label>}
      {mode !== 'update' && (mode !== 'signup' || !extended) && !(mode === 'signin' && loginMethod === 'username') && <label>이메일<input data-auth-edit="email-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
      {mode !== 'reset' && <label>비밀번호<input data-auth-edit="password-input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
      {mode === 'signup' && extended && <><label>비밀번호 재확인<input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label><label>이메일<input data-auth-edit="email-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label><label>휴대폰 번호<input type="tel" autoComplete="tel" required value={phone} onChange={event => setPhone(event.target.value)} disabled={busy} /></label><p>휴대폰 문자 인증 없이 이메일로 인증합니다.</p></>}
      {mode === 'signup' && signupConsent && <fieldset><legend>가입 안내 확인</legend><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required disabled={busy} /> <a href={signupConsent.terms.href} target="_blank" rel="noopener noreferrer">이용약관</a>에 동의합니다.</label><label><input type="checkbox" checked={privacyAcknowledged} onChange={event => setPrivacyAcknowledged(event.target.checked)} required disabled={busy} /> <a href={signupConsent.privacy.href} target="_blank" rel="noopener noreferrer">개인정보 수집 및 이용</a>에 동의합니다.</label>{extended && <label><input type="checkbox" checked={ageConfirmed} onChange={event => setAgeConfirmed(event.target.checked)} required disabled={busy} /> 만 14세 이상입니다.</label>}</fieldset>}
      <button data-auth-edit="submit-button" type="submit" disabled={busy || (mode === 'signin' && loginMethod === 'username' && typeof usernameSignIn !== 'function') || (mode === 'signup' && (!canSignup || !termsAccepted || !privacyAcknowledged || (extended && (!ageConfirmed || usernameState !== 'available' || checkedUsername !== normalizeUsername(username)))))}>{busy ? '처리 중…' : heading}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {!signedIn && !recovery && mode === 'signin' && loginMethod === 'username' && typeof usernameSignIn !== 'function' && <p role="note">아이디 로그인은 준비 중입니다. 이메일로 로그인해 주세요.</p>}
    {!signedIn && !recovery && <nav aria-label="회원 인증 메뉴">
      {mode === 'signin' && loginMethod === 'username' && <button type="button" disabled={busy} onClick={() => {setLoginMethod('email');setError('');setMessage('');setPassword('');}}>이메일로 로그인</button>}
      {mode === 'signin' && loginMethod === 'email' && signinVariant === 'username' && <button type="button" disabled={busy} onClick={() => {setLoginMethod('username');setError('');setMessage('');setPassword('');}}>아이디로 로그인</button>}
      {mode !== 'signin' && <button type="button" disabled={busy} onClick={() => clear('signin')}>로그인</button>}
      {canSignup && mode !== 'signup' && <button type="button" disabled={busy} onClick={() => clear('signup')}>회원가입</button>}
      {mode !== 'reset' && <button type="button" disabled={busy} onClick={() => clear('reset')}>비밀번호 재설정</button>}
    </nav>}
  </section>;
}
