'use client';

import React, {useEffect, useRef, useState} from 'react';

type Result = {ok:boolean;code:string};
type Notice = {href:string;version:string};
export type ManualCompletionInput = {
  name:string; username:string; email:string; phone:string;
  termsAccepted:true; privacyAccepted:true; ageConfirmed:true;
  termsVersion:string; privacyVersion:string;
};
export type ManualCompletionApi = {
  checkUsername(username:string):Promise<Result>;
  complete(input:ManualCompletionInput):Promise<Result>;
};
function safeNotice(notice:Notice) {
  return /^\/(?!\/)[A-Za-z0-9/_-]+\/$/.test(notice.href) && /^[A-Za-z0-9._-]{1,64}$/.test(notice.version);
}
const normalized = (value:string) => value.trim().toLowerCase();
const usernameValid = (value:string) => /^[a-z0-9][a-z0-9_-]{3,19}$/.test(value);

/** Inert until an embedding auth flow supplies an authenticated, verified email
 * and both operations. All identity, consent and uniqueness checks are repeated
 * by the server. No auth client, token, storage, or network access lives here.
 */
export function MemberCompleteManualCandidate({sessionKey,verifiedEmail,terms,privacy,api,onCompleted}:{
  sessionKey?:string; verifiedEmail?:string; terms:Notice; privacy:Notice; api?:ManualCompletionApi; onCompleted?:()=>void;
}) {
  const identity = `${sessionKey || ''}\u0000${verifiedEmail || ''}`;
  const initialIdentity = useRef(identity);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  // A session switch requires a remount; do not carry one user's pending form
  // or asynchronous response into a different authenticated session.
  const ready = Boolean(sessionKey && sessionKey.length <= 256 && initialIdentity.current === identity && verifiedEmail && verifiedEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedEmail) && safeNotice(terms) && safeNotice(privacy) && api && typeof api.checkUsername === 'function' && typeof api.complete === 'function');
  const [name,setName] = useState('');
  const [username,setUsername] = useState('');
  const [phone,setPhone] = useState('');
  const [termsAccepted,setTermsAccepted] = useState(false);
  const [privacyAccepted,setPrivacyAccepted] = useState(false);
  const [ageConfirmed,setAgeConfirmed] = useState(false);
  const [availability,setAvailability] = useState<'idle'|'checking'|'available'|'taken'|'error'>('idle');
  const [checked,setChecked] = useState('');
  const [busy,setBusy] = useState(false);
  const [finished,setFinished] = useState(false);
  const [error,setError] = useState('');
  const current = useRef(0);
  const busyRef = useRef(false);
  useEffect(() => () => { current.current += 1; }, []);
  const check = async () => {
    if (!ready || !api || busyRef.current || availability === 'checking') return;
    const candidate=normalized(username);
    if (!usernameValid(candidate)) { setAvailability('error'); setChecked(''); return; }
    const ticket=++current.current; setAvailability('checking'); setChecked('');
    try {
      const result=await api.checkUsername(candidate);
      if(ticket!==current.current || currentIdentity.current!==initialIdentity.current)return;
      if(result.ok && result.code==='available'){setChecked(candidate);setAvailability('available');}
      else if(result.ok && result.code==='unavailable')setAvailability('taken');
      else setAvailability('error');
    } catch {if(ticket===current.current && currentIdentity.current===initialIdentity.current)setAvailability('error');}
  };
  const submit = async (event:React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready || !api || !verifiedEmail || busyRef.current || finished || !termsAccepted || !privacyAccepted || !ageConfirmed) return;
    const candidate=normalized(username);
    if (!name.trim() || name.trim().length>100 || /[\u0000-\u001f\u007f]/.test(name.trim())) {setError('이름을 확인해 주세요.');return;}
    if (!usernameValid(candidate) || availability!=='available' || candidate!==checked) {setError('아이디 중복 확인을 해 주세요.');return;}
    if (!/^[0-9 -]+$/.test(phone) || !/^01[016789][0-9]{7,8}$/.test(phone.replace(/[ -]/g,''))) {setError('휴대폰 번호를 확인해 주세요.');return;}
    busyRef.current=true; setBusy(true);setError('');
    const ticket=++current.current;
    try {
      const result=await api.complete({name:name.trim(),username:candidate,email:verifiedEmail,phone:phone.trim(),termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:terms.version,privacyVersion:privacy.version});
      if(ticket!==current.current || currentIdentity.current!==initialIdentity.current)return;
      if(result.ok && result.code==='profile_completed'){setFinished(true);onCompleted?.();}
      else if(result.code==='username_taken'){setChecked('');setAvailability('taken');setError('이미 사용 중인 아이디입니다. 다른 아이디를 확인해 주세요.');}
      else if(result.code==='profile_exists')setError('이미 등록된 회원정보가 있습니다. 기존 회원정보를 확인하거나 문의해 주세요.');
      else if(result.code==='consent_required')setError('현재 약관 동의 기록이 없어 가입을 완료할 수 없습니다. 동의 절차가 준비되면 다시 시도해 주세요.');
      else if(result.code==='consent_unavailable')setError('약관 동의 기록을 확인하지 못해 가입을 완료하지 않았습니다. 잠시 후 다시 시도해 주세요.');
      else if(result.code==='completion_unconfirmed')setError('가입 완료 여부를 확인하지 못했습니다. 회원정보를 확인한 뒤 다시 시도하거나 문의해 주세요.');
      else if(result.code==='document_changed')setError('약관이 변경되어 가입을 완료하지 않았습니다. 최신 약관을 확인한 뒤 다시 동의해 주세요.');
      else if(result.code==='document_unverified')setError('약관 내용을 확인하지 못해 가입을 완료하지 않았습니다. 잠시 후 다시 확인해 주세요.');
      else if(result.code==='verification_required')setError('이메일 인증 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');
      else setError('가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } catch {if(ticket===current.current && currentIdentity.current===initialIdentity.current)setError('가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
    finally {if(ticket===current.current && currentIdentity.current===initialIdentity.current){busyRef.current=false;setBusy(false);}}
  };
  const availabilityText={idle:'영문 소문자, 숫자, 밑줄, 하이픈 4~20자를 사용해 주세요.',checking:'아이디를 확인하고 있습니다.',available:'사용 가능한 아이디입니다.',taken:'이미 사용 중인 아이디입니다.',error:'아이디 형식을 확인하거나 잠시 후 다시 시도해 주세요.'}[availability];
  if(identity !== initialIdentity.current)return <section aria-labelledby="complete-title"><h2 id="complete-title">회원가입 마무리</h2><p role="alert">로그인 상태가 변경되었습니다. 가입 화면을 다시 열어 주세요.</p></section>;
  if(finished)return <section aria-labelledby="complete-title"><h2 id="complete-title">가입 완료</h2><p role="status">회원 정보가 등록되었습니다.</p></section>;
  return <section aria-labelledby="complete-title"><h2 id="complete-title">회원가입 마무리</h2>
    <p>이메일 인증을 마쳤습니다. 다른 기기에서 인증했거나 입력 정보가 만료됐다면 회원 정보를 다시 입력해 주세요.</p>
    {!ready && <p role="note">인증 상태와 가입 서비스를 확인하고 있습니다.</p>}
    <form onSubmit={event=>void submit(event)}>
      <label>인증 이메일<input type="email" readOnly value={verifiedEmail || ''} /></label>
      <label>이름<input type="text" autoComplete="name" required maxLength={100} value={name} onChange={event=>setName(event.target.value)} disabled={busy || !ready}/></label>
      <label>아이디<input type="text" autoComplete="username" required minLength={4} maxLength={20} value={username} aria-describedby="manual-username-status" onChange={event=>{current.current+=1;setUsername(event.target.value);setChecked('');setAvailability('idle');}} disabled={busy || !ready}/></label>
      <button type="button" onClick={()=>void check()} disabled={!ready || busy || availability==='checking'}>아이디 중복 확인</button><p id="manual-username-status" role="status">{availabilityText}</p>
      <label>휴대폰 번호<input type="tel" autoComplete="tel" required value={phone} onChange={event=>setPhone(event.target.value)} disabled={busy || !ready}/></label>
      <fieldset disabled={busy || !ready}><legend>가입 안내 확인</legend><label><input type="checkbox" required checked={termsAccepted} onChange={event=>setTermsAccepted(event.target.checked)}/> {safeNotice(terms) ? <a href={terms.href} target="_blank" rel="noopener noreferrer">이용약관</a> : '이용약관'}에 동의합니다.</label><label><input type="checkbox" required checked={privacyAccepted} onChange={event=>setPrivacyAccepted(event.target.checked)}/> {safeNotice(privacy) ? <a href={privacy.href} target="_blank" rel="noopener noreferrer">개인정보 수집 및 이용</a> : '개인정보 수집 및 이용'}에 동의합니다.</label><label><input type="checkbox" required checked={ageConfirmed} onChange={event=>setAgeConfirmed(event.target.checked)}/> 만 14세 이상입니다.</label></fieldset>
      <button type="submit" disabled={!ready || busy || !termsAccepted || !privacyAccepted || !ageConfirmed || availability!=='available' || checked!==normalized(username)}>{busy?'처리 중…':'가입 완료'}</button>
    </form>{error && <p role="alert">{error}</p>}
  </section>;
}
