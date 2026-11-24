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
  </div>
  <div className="ds-ad-intro-copy">
   <h2 id={id} ref={title} tabIndex={-1}>광고비를 쓰기 전에<br/><em>검색 수요를 확인하세요.</em></h2>
   <p className="ds-ad-intro-source">2026년 10월 국내 검색엔진 유입 중 네이버 비중 42.25% · Statcounter</p>
   <p><strong>‘{product}’</strong> 관련 검색어, 검색량, 클릭당 비용(CPC)을 살펴보세요.</p>
   <div className="ds-ad-intro-actions"><button type="button" className="mp-primary" onClick={onContinue}>광고·키워드 분석 열기 <ArrowRight size={20}/></button><button type="button" className="mp-secondary" data-diagnosis-back onClick={onBack}><ArrowLeft size={16}/>판매 계획으로 돌아가기</button></div>
  </div>
 </section>;
}
