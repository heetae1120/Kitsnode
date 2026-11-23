import Link from 'next/link';
import LegacyPrivacy, { metadata } from './2026-11-14-naver/page';
import styles from '../policy.module.css';

export { metadata };

// Preserve what existing browser tabs associate with the old consent version.
export default function LegacyPrivacyPage() {
  return <><aside className={styles.policy}><p>이 페이지는 이전 개인정보 처리방침입니다. <Link href="/privacy/2026-11-23/">현재 개인정보 처리방침 보기</Link></p></aside><LegacyPrivacy /></>;
}
