"use client";
import {useId} from 'react';
import {ArrowLeft,ArrowRight,Search} from 'lucide-react';
import '@/app/tools/advertising-diagnosis-intro.css';

export function AdvertisingReviewGuide({months,onContinue,onBack}:{months:number;onContinue:()=>void;onBack:()=>void}){
 const id=useId();
 return <section className="ds-ad-review-guide" aria-labelledby={id}>
  <header>
   <h2 id={id} tabIndex={-1}>네이버 검색광고는<br/><em>언제 살펴볼 만할까요?</em></h2>
   <p>{months>0?`${months}개월 판매 목표`:'판매 목표'}에 비해 유입이 부족하다면, 상품을 검색하는 고객에게 닿는 방법으로 네이버 검색광고를 검토해 볼 수 있어요.</p>
  </header>
  <dl>
   <div><dt>검색하는 고객에게 닿을 수 있어요</dt><dd>상품과 관련된 검색 결과에 노출될 수 있어요. 검색량을 살펴 어떤 검색어에 수요가 있는지 확인해 보세요.</dd></div>
   <div><dt>예상 광고비를 판매 이익과 비교할 수 있어요</dt><dd>클릭당 비용과 구매 전환율로 주문 한 건을 얻는 데 드는 광고비를 추정해요. 상품 1개당 이익과 비교하면 집행 여부를 판단할 수 있어요.</dd></div>
  </dl>
  <p className="ds-ad-review-note">예상 광고비가 개당 이익을 넘거나 상품 페이지의 구매 전환율이 낮다면, 가격이나 상품 페이지부터 점검해 보세요.</p>
  <div className="ds-ad-intro-actions">
   <button type="button" className="mp-primary" onClick={onContinue}>다음 <ArrowRight size={20}/></button>
   <button type="button" className="mp-secondary" data-diagnosis-back onClick={onBack}><ArrowLeft size={16}/>판매 계획으로 돌아가기</button>
  </div>
 </section>;
}

export function AdvertisingDiagnosisIntro({productName,onContinue,onBack}:{productName:string;onContinue:()=>void;onBack:()=>void}){
 const id=useId();
 const product=productName.trim()||'내 상품';
 return <section className="ds-ad-intro" aria-labelledby={id}>
  <div className="ds-search-world" aria-hidden="true">
   <div className="ds-search-window"><div className="ds-search-browser"><i/><i/><i/></div>
    <div className="ds-search-box"><b>N</b><div className="ds-search-typing">{[product,product+' 추천',product+' 후기'].map((query,index)=><span key={index} style={{animationDelay:index*4+'s'}}>{query}</span>)}</div><Search size={30}/></div>
    <div className="ds-search-results">{[0,1,2].map(index=><div className="ds-search-result" key={index} style={{animationDelay:index*.65+'s'}}><span className={'ds-search-thumb ds-search-thumb-'+index}/><div><span className="ds-search-ad-label">광고</span><b>{product}{index===1?' 추천':index===2?' 살펴보기':''}</b><i/><i/></div></div>)}</div>
   </div>
  </div>
  <div className="ds-ad-intro-copy">
   <h2 id={id} tabIndex={-1}>국내 검색엔진 유입 중<br/>네이버 비중 <em>42.25%</em></h2>
   <p className="ds-ad-intro-source">2026년 10월 기준 · Statcounter</p>
   <p><strong>‘{product}’</strong> 관련 검색어, 검색량, 클릭당 비용(CPC)을 살펴보세요.</p>
   <div className="ds-ad-intro-actions"><button type="button" className="mp-primary" onClick={onContinue}>광고 키워드 진단하러 가기 <ArrowRight size={20}/></button><button type="button" className="mp-secondary" data-diagnosis-back onClick={onBack}><ArrowLeft size={16}/>광고 검토 기준으로 돌아가기</button></div>
  </div>
 </section>;
}
