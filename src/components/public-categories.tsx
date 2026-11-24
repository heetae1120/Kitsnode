import Link from 'next/link';
export function PublicCategories(){return <nav className="public-categories" aria-label="도구 메뉴"><Link href="/tools/">상품 진단</Link><Link href="/store/ads/">광고 분석</Link><Link href="/tools/keywords/">검색어 찾기</Link><Link href="/tools/survey/">설문</Link><Link href="/tools/about/">소개</Link></nav>;}
