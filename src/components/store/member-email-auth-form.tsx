'use client';

import React, { useEffect, useRef, useState } from 'react';

type Result = { ok: boolean; code: string };
export type SignupDraft = {username:string;name:string;phone:string;company:string;ageConfirmed:true};
export type EmailAuth = {
  signUp(email: string, password: string, evidence: {termsVersion:string;privacyVersion:string;termsAccepted:true;privacyAcknowledged:true},draft?:SignupDraft): Promise<Result>;
  verifySignupCode?(email:string,token:string):Promise<Result>;
  resendSignupCode?(email:string):Promise<Result>;
  signIn(email: string, password: string): Promise<Result>;
  signOut(): Promise<Result>;
  requestPasswordReset(email: string): Promise<Result>;
  updatePassword(password: string): Promise<Result>;
};
type Mode = 'signup' | 'signin' | 'reset' | 'update' | 'resume' | 'verify';
// The supplied operation must persist the accepted versions on the server as
// part of the validated registration workflow. Client checks are not a security boundary.
export type SignupConsent = {
  terms: { href: string; version: string };
  privacy: { href: string; version: string };
  register: (email: string, password: string, evidence: { termsVersion: string; privacyVersion: string; termsAccepted: true; privacyAcknowledged: true },draft:SignupDraft) => Promise<Result>;
};
function validNotice(notice: {href:string;version:string}) {
  return /^\/(?!\/)[A-Za-z0-9/_-]+\/$/.test(notice.href) && /^[A-Za-z0-9._-]{1,64}$/.test(notice.version);
}

export function EmailAuthForm({ auth, recovery = false, signedIn = false, initialMode = 'signin', allowSignup = false, signupConsent, previewStatus, usernameSignIn, resumeSignup, checkUsername }: { auth: EmailAuth; recovery?: boolean; signedIn?: boolean; initialMode?: 'signin' | 'signup'; allowSignup?: boolean; signupConsent?: SignupConsent; previewStatus?: 'error' | 'verification'; usernameSignIn?:(username:string,password:string)=>Promise<Result>;checkUsername?:(username:string)=>Promise<Result>;resumeSignup?:(email:string,password:string)=>Promise<Result> }) {
  const canSignup = Boolean(allowSignup && signupConsent && validNotice(signupConsent.terms) && validNotice(signupConsent.privacy) && typeof signupConsent.register === 'function');
  const [mode, setMode] = useState<Mode>(recovery ? 'update' : initialMode === 'signup' && !canSignup ? 'signin' : initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [name,setName]=useState(''),[phone,setPhone]=useState(''),[company,setCompany]=useState('');
  const [age,setAge]=useState(false),[checked,setChecked]=useState(''),[availability,setAvailability]=useState('');
  const checkSeq=useRef(0);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(previewStatus === 'verification' ? '요청을 처리했습니다. 입력한 이메일에서 인증 안내를 확인해 주세요.' : '');
  const [error, setError] = useState(previewStatus === 'error' ? '로그인 정보를 확인해 주세요.' : '');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  useEffect(() => { if (!recovery) setMode(current => current === 'update' ? 'signin' : current); }, [recovery]);
  const clear = (next: Mode) => { setMode(next); setMessage(''); setError(''); setPassword(''); setConfirmation(''); setTermsAccepted(false); setPrivacyAcknowledged(false); };
  const execute = async (fn: () => Promise<Result>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await fn();
      const messages: Record<string, string> = {
        signup_requested: '요청을 처리했습니다. 가입 가능한 이메일이라면 인증번호가 발송됩니다. 이미 가입한 계정이라면 아이디로 로그인해 주세요.',
        signup_code_resent: '요청을 처리했습니다. 이메일의 인증번호를 확인해 주세요.',
        email_verified: '이메일 인증이 완료되었습니다.',
        signed_in: '로그인되었습니다.',
        signed_out: '로그아웃되었습니다.',
        reset_requested: '요청을 처리했습니다. 해당 계정이 있다면 이메일의 안내를 확인해 주세요.',
        password_updated: '비밀번호가 변경되었습니다.',
      };
      if (result.ok && messages[result.code]) { setMessage(messages[result.code]); setPassword(''); setConfirmation(''); if (result.code === 'signup_requested') { setCode(''); setMode('verify'); } }
      else if (result.code === 'invalid_code') setError('인증번호가 올바르지 않거나 만료되었습니다. 확인하거나 다시 발송해 주세요.');
      else if (result.code === 'email_rate_limited') setError('요청이 너무 잦습니다. 잠시 기다린 뒤 다시 시도해 주세요.');
      else if (result.code === 'invalid_input') setError('이메일과 비밀번호를 다시 확인해 주세요.');
      else if (result.code === 'requires_confirmation') setError('이메일 인증을 완료한 뒤 다시 로그인해 주세요.');
      else if (result.code === 'sign_in_failed') setError('로그인 정보를 확인해 주세요.');
      else setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch { setError('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (mode === 'signup' && canSignup && signupConsent && termsAccepted && privacyAcknowledged) {
      if (!confirmation || password !== confirmation) { setError('비밀번호 확인이 일치하지 않습니다.'); return; }
      if(!age||!checkUsername||checked!==username.trim().toLowerCase()){setError('아이디 중복 확인과 나이 확인을 완료해 주세요.');return;}
      return void execute(() => signupConsent.register(email.trim(), password, {termsVersion:signupConsent.terms.version,privacyVersion:signupConsent.privacy.version,termsAccepted:true,privacyAcknowledged:true},{username:username.trim().toLowerCase(),name:name.trim(),phone:phone.trim(),company:company.trim(),ageConfirmed:true}));
    }
    if (mode === 'signup') return;
    if (mode === 'verify') return void execute(() => auth.verifySignupCode ? auth.verifySignupCode(email.trim(),code.trim()) : Promise.resolve({ok:false,code:'unavailable'}));
    if (mode === 'signin') { if (!usernameSignIn) {setError('아이디 로그인을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.'); return;} return void execute(() => usernameSignIn(username.trim().toLowerCase(),password)); }
    if (mode === 'resume') return void execute(() => resumeSignup ? resumeSignup(email.trim(),password) : Promise.resolve({ok:false,code:'unavailable'}));
    if (mode === 'reset') return void execute(() => auth.requestPasswordReset(email.trim()));
    return void execute(() => auth.updatePassword(password));
  };
  const heading = { signup: '이메일 회원가입', signin: '아이디 로그인', reset: '비밀번호 재설정', update: '새 비밀번호 설정', resume: '가입 이어하기', verify: '이메일 인증' }[mode];
  return <section aria-labelledby="auth-title">
    {!canSignup && <p role="note">회원가입은 준비 중입니다.</p>}
    <h2 id="auth-title">{heading}</h2>
    {mode === 'verify' && <p>가입할 때 입력한 이메일로 전송된 인증번호를 입력해 주세요. 인증번호는 60초 후 다시 요청할 수 있습니다.</p>}
    {mode === 'reset' && <p>가입한 이메일을 입력하고 아래 버튼을 누르면 재설정 안내를 보내드립니다.</p>}
    {mode === 'resume' && <p>이메일 인증을 마쳤지만 가입을 완료하지 못한 경우에만 이용할 수 있습니다.</p>}
    {mode === 'signup' && canSignup && <p>가입 시 이용약관과 개인정보 처리방침을 확인해 주세요.</p>}
    {signedIn && !recovery ? <button type="button" disabled={busy} onClick={() => void execute(() => auth.signOut())}>로그아웃</button> : <form onSubmit={submit}>
      {mode === 'signup' && <><label>아이디<input required minLength={4} maxLength={20} pattern="[A-Za-z0-9](?:[A-Za-z0-9_]|-){3,19}" autoComplete="username" value={username} onChange={event=>{checkSeq.current++;setUsername(event.target.value);setChecked('');setAvailability('')}} disabled={busy}/></label><button type="button" disabled={busy||!checkUsername} onClick={()=>{const candidate=username.trim().toLowerCase(),ticket=++checkSeq.current;setAvailability('확인 중입니다.');void checkUsername?.(candidate).then(result=>{if(ticket!==checkSeq.current)return;if(result.ok&&result.code==='available'){setChecked(candidate);setAvailability('사용 가능한 아이디입니다.')}else setAvailability(result.ok?'이미 사용 중인 아이디입니다.':'아이디를 확인하지 못했습니다.')}).catch(()=>{if(ticket===checkSeq.current)setAvailability('아이디를 확인하지 못했습니다.')})}}>아이디 중복 확인</button><p role="status">{availability}</p></>}
      {mode === 'signin' ? <label>아이디<input required autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} disabled={busy}/></label> : mode !== 'update' && mode !== 'signup' && <label>이메일<input data-auth-edit="email-input" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}
      {mode === 'verify' && <label>인증번호<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={code} onChange={event=>setCode(event.target.value)} disabled={busy}/></label>}
      {mode !== 'reset' && mode !== 'verify' && <label>비밀번호<input data-auth-edit="password-input" type="password" autoComplete={mode === 'signin' || mode === 'resume' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>}
      {mode === 'signup' && <label>비밀번호 재확인<input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
      {mode === 'signup' && <><label>이름<input required maxLength={100} autoComplete="name" value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label><label>이메일<input data-auth-edit="email-input" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} disabled={busy}/></label><p>가입 요청 후 이메일로 인증번호를 보내드립니다.</p><label>휴대폰 번호<input required type="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} disabled={busy}/></label><label>업체명 (선택)<input maxLength={100} autoComplete="organization" value={company} onChange={event=>setCompany(event.target.value)} disabled={busy}/></label><label><input type="checkbox" checked={age} onChange={event=>setAge(event.target.checked)} disabled={busy}/> 만 14세 이상입니다.</label></>}
      {mode === 'signup' && canSignup && signupConsent && <fieldset><legend>가입 안내 확인</legend><label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required disabled={busy} /> <a href={signupConsent.terms.href} target="_blank" rel="noopener noreferrer">이용약관</a>에 동의합니다.</label><label><input type="checkbox" checked={privacyAcknowledged} onChange={event => setPrivacyAcknowledged(event.target.checked)} required disabled={busy} /> <a href={signupConsent.privacy.href} target="_blank" rel="noopener noreferrer">임시 개인정보 처리방침</a>을 확인했습니다.</label></fieldset>}
      {mode === 'verify' && <button type="button" disabled={busy||!auth.resendSignupCode} onClick={()=>void execute(()=>auth.resendSignupCode ? auth.resendSignupCode(email.trim()) : Promise.resolve({ok:false,code:'unavailable'}))}>인증번호 다시 받기</button>}
      <button data-auth-edit="submit-button" type="submit" disabled={busy || (mode === 'signin' && !usernameSignIn) || (mode === 'signup' && (!canSignup || !termsAccepted || !privacyAcknowledged || !age || !checkUsername || checked!==username.trim().toLowerCase()))}>{busy ? '처리 중…' : heading}</button>
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    {!signedIn && !recovery && <nav aria-label="회원 인증 메뉴">
      {canSignup && mode !== 'verify' && <button type="button" disabled={busy} onClick={()=>clear('verify')}>이메일 인증하기</button>}
      {mode === 'signup' && resumeSignup && <button type="button" disabled={busy} onClick={()=>clear('resume')}>가입 이어하기</button>}
      {mode !== 'signin' && <button type="button" disabled={busy} onClick={() => clear('signin')}>로그인</button>}
      {canSignup && mode !== 'signup' && <button type="button" disabled={busy} onClick={() => clear('signup')}>회원가입</button>}
      {mode !== 'reset' && <button type="button" disabled={busy} onClick={() => clear('reset')}>비밀번호 재설정</button>}
    </nav>}
  </section>;
}
