import Link from 'next/link';
import LegacyTerms, { metadata } from './2026-11-14/page';
import styles from '../policy.module.css';

export { metadata };

// Existing browser tabs may still record the 2026-11-14 version after opening
// this URL. Keep that version here; current clients use the immutable URL.
export default function LegacyTermsPage() {
  return <><aside className={styles.policy} data-kn=""><p>이 페이지는 이전 이용약관입니다. <Link href="/terms/2026-11-23/">현재 이용약관 보기</Link></p></aside><LegacyTerms /></>;
}
