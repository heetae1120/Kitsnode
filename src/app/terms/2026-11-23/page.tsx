import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '../../policy.module.css';

export const metadata: Metadata = { title: '이용약관 | 키츠노드' };

export default function TermsPage() {
  return <main className={styles.policy} data-kn="">
    <h1>키츠노드 이용약관</h1>
    <p>시행일: 2026년 11월 23일 · 약관 버전: 2026-11-23</p>
    <section><h2>제1조 목적</h2><p>이 약관은 kits가 운영하는 키츠노드의 회원가입과 서비스 이용에 관한 사항을 정합니다.</p></section>
    <section><h2>제2조 회원가입과 계정</h2><p>이용자는 회원가입 화면에서 필요한 정보를 입력하고 본인이 사용할 수 있는 이메일을 인증하여 가입하거나 네이버 계정 인증을 통해 가입할 수 있습니다. 회원은 자신의 계정과 비밀번호를 안전하게 관리하고 타인의 계정을 무단으로 사용하지 않아야 합니다.</p></section>
    <section><h2>제3조 서비스 이용</h2><p>회원은 타인의 권리를 침해하거나 서비스의 안전한 운영을 방해해서는 안 됩니다. 각 서비스의 내용과 이용 조건은 해당 화면에서 안내합니다. 점검이나 장애 대응이 필요한 경우 서비스 제공이 일시 중단될 수 있습니다.</p></section>
    <section><h2>제4조 탈퇴와 문의</h2><p>회원은 로그인 후 회원 탈퇴 화면에서 안내를 확인하고 탈퇴를 요청할 수 있습니다. 처리가 어렵거나 개인정보 관련 문의가 있는 경우 <a href="mailto:jonho1@naver.com">jonho1@naver.com</a>으로 연락할 수 있습니다. 네이버 광고 계정에서 키츠노드에 부여한 권한은 네이버에서 직접 해제할 수 있습니다. 개인정보에 관한 권리 행사 방법은 개인정보 처리방침에서 안내합니다.</p></section>
    <section><h2>제5조 약관 변경</h2><p>약관을 변경하면 적용 전에 서비스 화면에 변경 내용과 적용 시점을 알립니다. 회원에게 불리한 변경의 고지와 동의 절차는 관련 법령에 따릅니다.</p></section>
    <p><Link href="/terms/2026-11-14/">이전 이용약관 보기</Link></p>
  </main>;
}
