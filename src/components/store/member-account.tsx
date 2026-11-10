"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { isEmailAuthAvailable, isMemberPreview, memberAuthBase, memberRequest, naverAuthorizationUrl } from "@/lib/member-auth-client";
import { StoreBadge, StoreButton, StoreCard } from "./store-ui";
import { memberAccessStatus } from './member-access-status';
import { MemberPreview, type MemberPreviewStage } from "./member-preview";
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import { validPreviewStage } from '@/lib/layout-preview';

type Session = { authenticated: boolean; consented: boolean; memberAccess: boolean; consentStatus: Choices; emailVerified: boolean; emailVerificationAvailable: boolean; naverAvailable?: boolean; emailAvailable?: boolean };
type ConsentKind = 'terms' | 'privacy';
type ConsentDocument = { type: ConsentKind; version: string; text: string };
type ConsentDocuments = { terms: ConsentDocument; privacy: ConsentDocument };
type Choices = Record<ConsentKind, boolean>;
const emptyChoices: Choices = { terms: false, privacy: false };

function parseDocuments(value: unknown): ConsentDocuments | null {
  if (!value || typeof value !== 'object' || !('documents' in value) || !Array.isArray(value.documents) || value.documents.length !== 2) return null;
  const docs: Partial<ConsentDocuments> = {};
  for (const item of value.documents) {
    if (!item || typeof item !== 'object' || (item.type !== 'terms' && item.type !== 'privacy') || typeof item.version !== 'string' || !item.version.trim() || typeof item.text !== 'string' || !item.text.trim() || docs[item.type as ConsentKind]) return null;
    docs[item.type as ConsentKind] = item as ConsentDocument;
  }
  return docs.terms && docs.privacy ? { terms: docs.terms, privacy: docs.privacy } : null;
}

function ConsentFields({ documents, choices, setChoices, disabled, accepted = emptyChoices }: { documents: ConsentDocuments; choices: Choices; setChoices: (value: Choices) => void; disabled: boolean; accepted?: Choices }) {
  return <div className="store-auth-terms">
    {(['terms', 'privacy'] as const).map(kind => <section key={kind} aria-labelledby={`consent-${kind}-title`}>
      <h3 id={`consent-${kind}-title`}>{kind === 'terms' ? '이용약관' : '개인정보 수집·이용 안내'}</h3>
      <p className="store-caption">문서 버전: {documents[kind].version}</p>
      <div className="store-auth-terms-copy" tabIndex={0} aria-label={`${kind === 'terms' ? '이용약관' : '개인정보 수집·이용 안내'} 내용`}>{documents[kind].text}</div>
      {accepted[kind] ? <p role="status">현재 버전에 동의했습니다.</p> : <label className="store-auth-check"><input type="checkbox" checked={choices[kind]} disabled={disabled} onChange={e => setChoices({ ...choices, [kind]: e.target.checked })} /> {kind === 'terms' ? '[필수] 이용약관에 동의합니다.' : '[필수] 개인정보 수집·이용에 동의합니다.'}</label>}
    </section>)}
  </div>;
}
const endpoint = memberAuthBase(process.env.NEXT_PUBLIC_MEMBER_AUTH_URL);
const localEndpoint = endpoint !== null && ['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname);

export function MemberAccount({ mode }: { mode: "login" | "signup" }) {
  const [preview, setPreview] = useState(true);
  const [synthetic, setSynthetic] = useState(false);
  const [editorStage, setEditorStage] = useState<MemberPreviewStage>('default');
  const page = mode === 'signup' ? '/store/signup/' : '/store/login/';
  const draftStage = useDraftPreviewStage(page);
  const [session, setSession] = useState<Session | null>(null);
  const [documents, setDocuments] = useState<ConsentDocuments | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [choices, setChoices] = useState<Choices>(emptyChoices);
  const [resetToken, setResetToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const search = () => typeof window === "undefined" ? "?kits_preview" : window.location.search;
  const request = useCallback((path: string, body?: Record<string, unknown>) => memberRequest(endpoint, search(), path, body), []);

  const refresh = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([request('/api/member/session'), request('/api/member/terms')]);
      const parsed = parseDocuments(t);
      if (!s || typeof s !== 'object' || typeof (s as Session).authenticated !== 'boolean' || typeof (s as Session).consented !== 'boolean' || typeof (s as Session).memberAccess !== 'boolean' || typeof (s as Session).emailVerified !== 'boolean' || typeof (s as Session).emailVerificationAvailable !== 'boolean' || !(s as Session).consentStatus || typeof (s as Session).consentStatus.terms !== 'boolean' || typeof (s as Session).consentStatus.privacy !== 'boolean' || (s as Session).consented !== ((s as Session).consentStatus.terms && (s as Session).consentStatus.privacy) || !parsed) throw new Error('서비스 응답을 확인할 수 없습니다.');
      setSession(s as Session); setDocuments(parsed); setChoices(emptyChoices);
    } catch (error) {
      setSession(null); setDocuments(null); setChoices(emptyChoices); throw error;
    }
  }, [request]);

  useEffect(() => {
    if (isMemberPreview(window.location.search)) {
      setSynthetic(true);
      const q = new URLSearchParams(window.location.search);
      const stage = q.has('kits_editor') ? q.get('kits_stage') : null;
      if (stage && validPreviewStage(page,stage)) setEditorStage(stage as MemberPreviewStage);
      return;
    }
    setPreview(false);
    if (!endpoint) return;
    const current = new URL(window.location.href);
    const token = current.searchParams.get('token');
    if (token && token.length <= 1024) { setResetToken(token); current.searchParams.delete('token'); window.history.replaceState(window.history.state, '', current.pathname + current.search + current.hash); }
    let active = true;
    // No auth or session requests run inside editor/preview documents.
    refresh().catch(() => { if (active) setError('인증 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'); });
    return () => { active = false; };
  }, [page, refresh]);

  async function run(action: () => Promise<void>) {
    if (preview || !endpoint || busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch { setError('요청을 처리하지 못했습니다. 입력 정보와 연결 상태를 확인하고 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!isEmailAuthAvailable(session)) throw new Error('Email sign-in unavailable');
      if (resetToken) {
        await request('/api/auth/reset-password', { newPassword: password, token: resetToken }); setResetToken(''); setPassword(''); setMessage('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
      } else if (mode === 'signup') {
        if (!choices.terms || !choices.privacy || !documents) throw new Error('Terms required');
        await request('/api/auth/sign-up/email', { email, password, name: '', consents: (['terms', 'privacy'] as const).map(type => ({ type, version: documents[type].version, accepted: true })), callbackURL: `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/store/login/` });
        setPassword(''); setMessage('인증 메일이 도착하면 안내에 따라 인증해 주세요. 메일이 오지 않았다면 가입한 이메일과 비밀번호로 로그인해 재발송을 요청할 수 있습니다.');
      } else {
        await request('/api/auth/sign-in/email', { email, password }); setPassword(''); await refresh();
      }
    });
  }
  const disabled = preview || !endpoint || busy;
  const emailDisabled = disabled || !isEmailAuthAvailable(session);
  const accessStatus = session ? memberAccessStatus(session) : null;
  if (synthetic) return <MemberPreview mode={mode} stage={(draftStage || editorStage) as MemberPreviewStage} />;
  return <StoreCard className="store-account-card" aria-labelledby="account-title">
    <div className="store-icon"><LockKeyhole size={24} aria-hidden="true" /></div>
    {localEndpoint && !preview && <p className="store-caption" role="note">로컬 테스트 환경입니다. 실제 회원 정보는 입력하지 마세요.</p>}
    {(!endpoint || preview) ? <><StoreBadge tone="warning">회원 인증 준비 중</StoreBadge><h2 id="account-title">아직 {mode === 'signup' ? '회원가입할' : '로그인할'} 수 없어요</h2><p id="account-unavailable">인증 서비스가 연결되지 않았거나 읽기 전용 미리보기입니다.</p><StoreButton disabled aria-describedby="account-unavailable">회원 인증 · 준비 중</StoreButton></> : <>
      <h2 id="account-title">{session?.authenticated ? '내 계정' : resetToken ? '새 비밀번호 설정' : mode === 'signup' ? '이메일로 가입하기' : '계속하려면 로그인해 주세요'}</h2>
      {session?.authenticated ? <>
        {session.consented ? <p>{accessStatus?.message}</p> : documents && <><p>회원 기능을 사용하려면 아래 내용을 확인하고 필요한 항목에 동의해 주세요.</p><ConsentFields documents={documents} choices={choices} setChoices={setChoices} disabled={disabled} accepted={session.consentStatus} /><StoreButton disabled={disabled || (!session.consentStatus.terms && !choices.terms) || (!session.consentStatus.privacy && !choices.privacy)} onClick={() => void run(async () => { await request('/api/member/consent', { consents: (['terms', 'privacy'] as const).filter(type => !session.consentStatus[type]).map(type => ({ type, version: documents[type].version, accepted: true })) }); await refresh(); })}>동의하고 계속하기</StoreButton></>}
        {accessStatus?.showRequiredEmail && <section aria-labelledby="member-email-verification-title">
          <h3 id="member-email-verification-title">이메일 인증이 필요해요</h3>
          <p>회원 기능을 이용하려면 가입한 이메일을 인증해 주세요. 메일이 도착하면 안내에 따라 인증한 뒤 상태를 확인해 주세요.</p>
          {session.emailVerificationAvailable ? <StoreButton className="store-button--secondary" disabled={disabled} onClick={() => void run(async () => { await request('/api/member/verify-email', {}); setMessage('인증 메일을 요청했습니다. 메일이 도착하면 안내에 따라 인증해 주세요.'); })}>인증 메일 요청</StoreButton> : <p className="store-caption" role="note">현재 이메일 인증을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>}
          <StoreButton className="store-button--secondary" disabled={disabled} onClick={() => void run(refresh)}>인증 상태 확인</StoreButton>
        </section>}
        {accessStatus?.showEmailSensitiveNote && <p className="store-caption">이메일 소유 확인이 필요한 기능은 별도 인증 후 이용할 수 있습니다.</p>}
        <StoreButton className="store-button--secondary" disabled={disabled} onClick={() => void run(async () => { await request('/api/auth/sign-out', {}); setSession(current => current ? {...current, authenticated:false, consented:false, memberAccess:false, emailVerified:false, consentStatus:emptyChoices} : null); })}>로그아웃</StoreButton>
      </> : <form className="store-auth-form" onSubmit={submit}>
        {session && !isEmailAuthAvailable(session) && <p className="store-caption" role="note">현재 인증 서버에서 이메일 가입과 로그인을 사용할 수 없습니다.</p>}
        {!resetToken && <><label htmlFor="member-email">이메일</label><input id="member-email" data-auth-edit="email-input" type="email" autoComplete="email" required disabled={emailDisabled} value={email} onChange={e => setEmail(e.target.value)} /></>}
        {mode === 'login' && !resetToken && <p className="store-caption">인증 메일을 받지 못했다면 가입한 이메일과 비밀번호로 로그인해 주세요. 인증이 필요하면 메일 발송을 다시 시도합니다.</p>}
        <label htmlFor="member-password">비밀번호</label><input id="member-password" data-auth-edit="password-input" type="password" autoComplete={mode === 'signup' || resetToken ? 'new-password' : 'current-password'} required disabled={emailDisabled} minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        {mode === 'signup' && !resetToken && documents && <><ConsentFields documents={documents} choices={choices} setChoices={setChoices} disabled={disabled} /><p className="store-caption">이메일 인증과 로그인 후 계정에 동의를 기록하기 위해 다시 확인합니다.</p></>}
        <StoreButton type="submit" data-auth-edit="submit-button" disabled={emailDisabled || !documents || (mode === 'signup' && !resetToken && (!choices.terms || !choices.privacy))}>{busy ? '처리 중…' : resetToken ? '비밀번호 변경' : mode === 'signup' ? '회원가입' : '로그인'}</StoreButton>
        {!resetToken && <><StoreButton className="store-button--secondary" data-auth-edit="naver-button" disabled={disabled || !session || session.authenticated || session.naverAvailable !== true} aria-describedby="naver-unavailable" onClick={() => void run(async () => {
          const callbackURL = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/store/login/`;
          const result = await request('/api/auth/sign-in/social', { provider: 'naver', callbackURL });
          const url = naverAuthorizationUrl(result && typeof result === 'object' ? (result as { url?: unknown }).url : null, endpoint!);
          if (!url) throw new Error('Invalid authorization URL');
          window.location.assign(url);
        })}>네이버로 계속하기{session?.naverAvailable === true ? '' : ' · 준비 중'}</StoreButton><p id="naver-unavailable" className="store-caption">{session?.naverAvailable === true ? '네이버에서 본인 확인 후 돌아옵니다.' : '네이버 로그인은 연결 준비 중입니다.'}</p></>}
        {mode === 'login' && !resetToken && <StoreButton className="store-button--secondary" disabled={emailDisabled || !email} onClick={() => void run(async () => { if (!isEmailAuthAvailable(session)) throw new Error('Email recovery unavailable'); await request('/api/auth/request-password-reset', {email, redirectTo:`${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/store/login/`}); setMessage('계정이 있다면 비밀번호 재설정 메일이 발송됩니다.'); })}>비밀번호 재설정 메일 받기</StoreButton>}
      </form>}
    </>}
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <div className="store-actions"><Link className="store-button store-button--secondary" href="/store/ads/example/">합성 예시 분석 보기</Link><Link className="store-text-link" href={mode === 'signup' ? '/store/login/' : '/store/signup/'}>{mode === 'signup' ? '로그인' : '회원가입'}</Link></div>
  </StoreCard>;
}
