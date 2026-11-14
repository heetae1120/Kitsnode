import Link from "next/link";

export function StudioFooter() {
  return <footer className="kn-colophon">
    <div><strong>KITSNODE<span>.</span></strong><p>브랜드 전략 · 광고 컨설팅</p></div>
    <nav aria-label="주요 서비스와 정책"><Link href="/tools/">판매 준비 ↗</Link><Link href="/tools/player/">광고 점검 ↗</Link><Link href="/tools/consultation/">브랜드 상담 ↗</Link><Link href="/terms/">이용약관</Link><Link href="/privacy/">임시 개인정보 처리방침</Link></nav>
  </footer>;
}
