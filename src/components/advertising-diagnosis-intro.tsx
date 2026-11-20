"use client";
import {useEffect,useId,useRef} from 'react';
import {ArrowLeft,ArrowRight,Search} from 'lucide-react';
import '@/app/tools/advertising-diagnosis-intro.css';

export function AdvertisingDiagnosisIntro({productName,onContinue,onBack}:{productName:string;onContinue:()=>void;onBack:()=>void}){
 const title=useRef<HTMLHeadingElement>(null),id=useId();
 const product=productName.trim()||'내 상품';
 useEffect(()=>{title.current?.focus({preventScroll:true});title.current?.closest('section')?.scrollIntoView({behavior:'instant',block:'start'});},[]);
 return <section className="ds-ad-intro" aria-labelledby={id}>
  <div className="ds-search-world" aria-hidden="true">
   <div className="ds-search-window"><div className="ds-search-browser"><i/><i/><i/></div>
    <div className="ds-search-box"><b>N</b><div className="ds-search-typing">{[product,product+' 추천',product+' 후기'].map((query,index)=><span key={index} style={{animationDelay:index*4+'s'}}>{query}</span>)}</div><Search size={30}/></div>
    <div className="ds-search-results">{[0,1,2].map(index=><div className="ds-search-result" key={index} style={{animationDelay:index*.65+'s'}}><span className={'ds-search-thumb ds-search-thumb-'+index}/><div><span className="ds-search-ad-label">광고</span><b>{product}{index===1?' 추천':index===2?' 살펴보기':''}</b><i/><i/></div></div>)}</div>
   </div>
   <span className="ds-search-demo">검색 흐름 예시</span>
  </div>
  <div className="ds-ad-intro-copy"><span className="ds-ad-intro-eyebrow">NEXT / SEARCH ADS</span>
   <h2 id={id} ref={title} tabIndex={-1}>스마트스토어에서<br/>빠르게 팔고 싶다면,<br/><em>검색광고비부터<br className="ds-ad-intro-mobile-break"/> 확인하세요.</em></h2>
   <p>선택한 품목 <strong>‘{product}’</strong>과 키워드를 바탕으로<br/>필요한 광고비와 남는 이익을 함께 진단합니다.</p>
   <div className="ds-ad-intro-actions"><button type="button" className="mp-primary" onClick={onContinue}>내 상품 광고비 진단하기 <ArrowRight size={20}/></button><button type="button" className="mp-secondary" onClick={onBack}><ArrowLeft size={16}/>이전 · 판매 계획</button></div>
  </div>
 </section>;
}
