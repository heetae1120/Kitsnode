'use client';
import naverStyles from './naver-login.module.css';

/** Shared by the real sign-in flow and the isolated, inert editor preview. */
export function MemberNaverSignIn({ basePath, busy, signIn }: { basePath: string; busy: boolean; signIn: () => void }) {
  return <div><button data-auth-edit="naver-button" type="button" className={naverStyles.imageButton} aria-label="네이버 로그인" disabled={busy} onClick={signIn}><img src={`${basePath}/naver-login/login.png`} alt="" width="210" height="48" /></button><p>네이버 계정으로 로그인할 수 있습니다. 인증 후 이용약관과 임시 개인정보 처리방침을 확인합니다. 기존 이메일 회원은 이메일로 로그인한 뒤 네이버 계정을 연결할 수 있습니다.</p></div>;
}
