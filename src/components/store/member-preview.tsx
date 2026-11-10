import { LockKeyhole } from 'lucide-react';
import { StoreButton, StoreCard } from './store-ui';

export type MemberPreviewStage = 'default' | 'error' | 'verification' | 'authenticated' | 'consent';

/** Synthetic and inert: no session, credentials, form submissions, or OAuth. */
export function MemberPreview({mode, stage}: {mode: 'login' | 'signup'; stage: MemberPreviewStage}) {
  return <StoreCard className="store-account-card" aria-labelledby="account-title" data-preview-stage={stage}>
    <div className="store-icon"><LockKeyhole size={24} aria-hidden="true" /></div>
    <p className="store-caption">예시 화면 · 실제 가입 및 로그인 요청 없음</p>
    {stage === 'verification' ? <><h2 id="account-title">인증 메일을 확인해 주세요</h2><p>예시 안내입니다. 메일을 발송하지 않았습니다.</p></> :
     stage === 'authenticated' ? <><h2 id="account-title">로그인 완료</h2><p>로그인 완료 상태의 예시입니다.</p></> :
     stage === 'consent' ? <><h2 id="account-title">서비스 이용 동의</h2><p>약관 확인 상태의 예시입니다. 실제 동의가 아닙니다.</p>
      <div className="store-auth-terms">{(['이용약관', '개인정보 수집·이용 안내'] as const).map((label) => <section key={label}>
        <h3>{label}</h3><p className="store-caption">문서 버전: 예시</p>
        <div className="store-auth-terms-copy">실제 문서가 아닌 미리보기 예시입니다.</div>
        <label className="store-auth-check"><input type="checkbox" disabled /> [필수] {label}에 동의합니다.</label>
      </section>)}</div><StoreButton disabled>동의하고 계속하기</StoreButton></> : <>
      <h2 id="account-title">{mode === 'signup' ? '이메일로 가입하기' : '계속하려면 로그인해 주세요'}</h2>
      <div className="store-auth-form">
        <label htmlFor="preview-member-email">이메일</label><input id="preview-member-email" data-auth-edit="email-input" type="email" autoComplete="off" readOnly tabIndex={-1} />
        <label htmlFor="preview-member-password">비밀번호</label><input id="preview-member-password" data-auth-edit="password-input" type="password" autoComplete="off" readOnly tabIndex={-1} />
        {stage === 'error' && <p role="alert">예시 오류: 입력 내용을 확인해 주세요.</p>}
        <StoreButton data-auth-edit="submit-button" aria-disabled="true" tabIndex={-1}>{mode === 'signup' ? '회원가입' : '로그인'}</StoreButton>
        <StoreButton className="store-button--secondary" data-auth-edit="naver-button" aria-disabled="true" tabIndex={-1}>네이버로 계속하기</StoreButton>
      </div>
    </>}
  </StoreCard>;
}
