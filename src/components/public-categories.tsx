import Link from 'next/link';

export const AD_KEYWORD_LABEL='광고·키워드 분석';
export const AD_CHECK_HREF='/tools/?view=ad-check';
export const SURVEY_HREF='/tools/about/#survey';
const links=[
 {id:'profit',href:'/tools/',label:'상품 진단'},
 {id:'ads',href:'/store/ads/',label:'광고 분석'},
 {id:'keywords',href:AD_CHECK_HREF,label:AD_KEYWORD_LABEL},
 {id:'about',href:'/tools/about/',label:'소개'},
] as const;

export function PublicCategories({active}:{active?:string}){
 return <nav className="public-categories" aria-label="도구 메뉴">
  {links.map(link=><Link key={link.id} href={link.href} aria-current={active===link.id?'page':undefined}>{link.label}</Link>)}
 </nav>;
}

export function AdvertisingToolNavigation({active}:{active:'ad-check'|'keywords'}){
 return <nav className="advertising-tool-nav" aria-label={AD_KEYWORD_LABEL}>
  <Link href={AD_CHECK_HREF} aria-current={active==='ad-check'?'page':undefined}>광고 체크</Link>
  <Link href="/tools/keywords/" aria-current={active==='keywords'?'page':undefined}>검색어 찾기</Link>
 </nav>;
}
