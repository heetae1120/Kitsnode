"use client";
import {useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Boxes,Ship,ShieldCheck} from 'lucide-react';
import {FormattedNumberInput} from './formatted-number-input';
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
export function SellingPreparation({quantity,months,onBack}:{quantity:number;months:number;onBack:()=>void}){
 const [certification,setCertification]=useState('1000000');
 const certificate=Number(certification);const valid=certification!==''&&Number.isFinite(certificate)&&certificate>=0;
 return <article className="mp-preparation"><header className="mp-story-heading"><span>판매 준비, 여기까지 보셨나요?</span><h1>사실, 물건을 팔려면<br/><em>더 준비할 게 있어요.</em></h1><p>보관·수입·인증까지. 내 상품에 필요한지 확인해 보세요.</p></header>
  <p className="mp-prep-note">아래는 준비 비용을 이해하기 위한 예시예요. 앞선 보고서에 자동으로 더하지 않아요. 이미 입력한 배송·물류비는 중복해서 더하지 마세요.</p>
  <section className="mp-prep-card"><PreparationImage kind="warehouse"/><Boxes size={25}/><span>01 · 3자물류(3PL)</span><h2>보관하고, 포장하고, 보내는 비용</h2><p>직접 배송하기 어렵다면 물류업체에 맡길 수 있어요.</p><strong>소형 출고 1건 2,900원부터</strong><p>SSPLogistics 공개 요금의 극소 규격 예시예요. 택배비·부자재 포함, 부가세 별도입니다.</p><dl className="mp-breakdown"><div><dt>{quantity.toLocaleString('ko-KR')}건 출고 예시</dt><dd>{money(quantity*2900)}</dd></div><div><dt>1팔레트 · 하루 600원 × 30일 × {months}개월</dt><dd>{money(600*30*months)}</dd></div></dl><small>1주문에 1개, 월 30일로 계산했어요. 크기·입고 작업·보관량에 따라 달라져요.</small><a href="https://www.ssplogis.com/price" target="_blank" rel="noopener noreferrer">공개 요금 확인 · 2026.11.04 확인</a></section>
  <section className="mp-prep-card"><PreparationImage kind="shipping"/><Ship size={25}/><span>02 · 중국에서 한국으로 수입</span><h2>운송비 말고, 세금과 통관 비용도 있어요</h2><strong>관세·수입부가세 188,000원 · 계산 예시</strong><p>운임·보험료를 포함한 과세가격 100만 원, 관세율 8%를 가정하면:</p><dl className="mp-breakdown"><div><dt>관세 · 100만 원 × 8%</dt><dd>80,000원</dd></div><div><dt>수입부가세 · (100만 원 + 8만 원) × 10%</dt><dd>108,000원</dd></div></dl><small>8%는 예시이며 내 품목의 확정 세율이 아니에요. 품목·원산지·협정에 따라 달라져요. 국제 운송·통관 대행료는 별도 견적이고, 수입부가세의 공제 여부도 따로 확인해야 해요. 이 예시는 다른 세금이 없는 경우예요.</small><a href="https://unipass.customs.go.kr/clip/ctensrch/openULS0401002Q.do" target="_blank" rel="noopener noreferrer">관세청 수입 세금 안내</a></section>
  <section className="mp-prep-card"><PreparationImage kind="testing"/><ShieldCheck size={25}/><span>03 · 제품 인증·시험</span><h2>판매 전에 인증이 필요한 상품도 있어요</h2><p>전기용품·어린이제품 등은 품목에 따라 필요한 인증과 시험이 달라요.</p><label htmlFor="mp-cert-example">인증·시험비를 가정해 보세요 · 견적 아님</label><div className="mp-input-wrap"><FormattedNumberInput id="mp-cert-example" value={certification} onValueChange={setCertification}/><span>원 / 전체</span></div><strong>{valid?`준비한 상품 1개당 ${money(certificate/quantity)}`:'금액을 입력해 주세요'}</strong><small>기본 100만 원은 계산 연습용 가정이에요. 평균가나 실제 견적이 아니에요. 인증 대상 여부·모델·시험 항목을 확인한 뒤 시험기관 견적을 받아야 해요.</small><a href="https://www.ktr.or.kr/main/index.do" target="_blank" rel="noopener noreferrer">KTR 시험·인증 안내</a></section>
  <section className="mp-prep-consult"><h2>이런 비용까지 알고 계셨나요?</h2><p>브랜드 기획부터 수입·인증·물류·홍보까지,<br/>전체 준비를 함께 점검하고 싶다면 상담해 보세요.</p><Link className="mp-primary" href="/tools/consultation/">상담하러 가기<ArrowRight size={17}/></Link></section>
  <button type="button" className="mp-secondary" onClick={onBack}><ArrowLeft size={16}/> 보고서로 돌아가기</button>
 </article>;
}

// Each photo was confirmed as free under the Unsplash License on 2026-11-05.
// These are illustrative stock photos, not images of a partner facility or proof of certification.
const preparationPhotos={
 warehouse:{id:'photo-1749244768351-2726dc23d26c',alt:'상품 상자와 보관 선반이 있는 물류 창고',author:'Russ Murray',source:'https://unsplash.com/photos/a-warehouse-is-filled-with-shelves-and-boxes-M7G_m5XJ-go'},
 shipping:{id:'photo-1634638022845-1ab614a94128',alt:'컨테이너를 실은 화물선과 항구',author:'Mika Baumeister',source:'https://unsplash.com/photos/a-large-cargo-ship-loaded-with-lots-of-containers-WqZwkrBuZIE'},
 testing:{id:'photo-1766297247072-93fd815afef3',alt:'시험 장비와 유리 기구가 놓인 실험실',author:'Chidera Faustina Okeke',source:'https://unsplash.com/photos/laboratory-shelves-filled-with-glassware-and-equipment-v41sgDGz4ik'}
};
function PreparationImage({kind}:{kind:keyof typeof preparationPhotos}){
 const photo=preparationPhotos[kind];
 return <figure className="mp-prep-photo"><img className="mp-prep-image" src={`https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=1400&h=525&q=85`} width={1400} height={525} alt={photo.alt} loading="lazy" decoding="async"/><figcaption><span>설명용 사진</span><a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.author} / Unsplash</a><a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">사용 허가</a></figcaption></figure>;
}
