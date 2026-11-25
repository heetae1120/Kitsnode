'use client';

import {useState} from 'react';
import Link from 'next/link';
import {keywordEconomics,matchKeywordCategory,normalizeKeyword} from '@/lib/keyword-budget';
import {saveMemberReturn} from '@/lib/member-return';
import {useSavedDiagnoses} from './diagnosis-download';

type AdDiagnosis={name:string;price:number;productCost?:number;unitCost:number;margin:number;examples:boolean};
const money=(value:number)=>Math.round(value).toLocaleString('ko-KR')+'원';

function AdEstimate({diagnosis,keyword}:{diagnosis:AdDiagnosis;keyword:string}){
 const [clickCost,setClickCost]=useState<string|null>(null);
 const [conversion,setConversion]=useState('2');
 const category=matchKeywordCategory(keyword);
 const reference=category&&[category.main,...category.alternatives].find(row=>normalizeKeyword(row.keyword)===normalizeKeyword(keyword));
 const cpc=clickCost??String(reference?.cpc??'');
 const rate=Number(conversion);
 const validRate=rate>0&&rate<=100;
 const limit=validRate?diagnosis.margin*rate/100:null;
 const estimate=keywordEconomics(Number(cpc),rate,diagnosis.margin,0);
 const contribution=estimate?Math.round(estimate.contribution):null;
 const status=diagnosis.margin<=0?'risk':contribution===null?'pending':contribution<0?'risk':contribution===0?'caution':'safe';
 const verdict={
  risk:diagnosis.margin<=0?'현재 판매 조건에서는 광고비를 감당하기 어려워요.':'이 조건에서는 광고비를 빼면 손실이 예상돼요.',
  caution:'이 조건에서는 광고비까지 빼면 본전이에요.',
  safe:'이 조건에서는 광고비를 빼도 이익이 남아요.',
  pending:'클릭 비용과 구매 전환율을 입력하면 광고 후 손익을 확인할 수 있어요.',
 };
 return <>
  <h3>{diagnosis.name}</h3>
  <dl className="ds-ad-diagnosis-metrics">
   <div><dt>판매가</dt><dd>{money(diagnosis.price)}</dd></div>
   {diagnosis.productCost!==undefined&&<div><dt>상품 원가</dt><dd>{money(diagnosis.productCost)}</dd></div>}
   <div><dt>개당 총 판매 비용</dt><dd>{money(diagnosis.unitCost)}</dd></div>
   <div><dt>개당 이익</dt><dd>{money(diagnosis.margin)}</dd></div>
  </dl>
  <p>진단서의 판매 조건으로 ‘{keyword}’ 네이버 검색광고를 계산해요. 구매 1건당 상품 1개 판매를 가정해요.</p>
  {diagnosis.examples&&<p>진단서에 참고 비용이 포함되어 있어요.</p>}
  <div className="ds-ad-diagnosis-inputs">
   <label>클릭당 비용 (원)<input type="number" min="1" step="any" inputMode="decimal" value={cpc} onChange={event=>setClickCost(event.target.value)}/></label>
   <label>가정 구매 전환율 (%)<input type="number" min="0.01" max="100" step="any" inputMode="decimal" value={conversion} onChange={event=>setConversion(event.target.value)}/></label>
  </div>
  {reference&&clickCost===null&&<p>클릭당 비용은 2026년 10월 관련 광고의 평균값이에요 ({reference.device}, 세금 포함).</p>}
  <div className="ds-ad-diagnosis-verdict" data-status={status} aria-live="polite">
   <strong>{verdict[status]}</strong>
   {limit!==null&&diagnosis.margin>0&&<p>이 전환율에서 클릭당 {limit.toLocaleString('ko-KR',{maximumFractionDigits:2})}원까지 광고비를 감당할 수 있어요.</p>}
   {estimate&&<p>구매 1건당 예상 광고비 {money(estimate.cpa)} · 광고 후 예상 손익 {money(estimate.contribution)}</p>}
  </div>
 </>;
}

export function AdDiagnosisCheck({current,keyword,onImport,onStart}:{current:AdDiagnosis|null;keyword:string;onImport:(name:string)=>void;onStart:()=>void}){
 const {saved,signedIn}=useSavedDiagnoses();
 const [selected,setSelected]=useState('');
 const usable=saved.filter(item=>item.quantity>0);
 const record=usable.find(item=>item.id===selected);
 const receipt=record?{
  name:record.name,
  price:typeof record.price==='number'&&Number.isFinite(record.price)?record.price:record.sales/record.quantity,
  productCost:Number.isFinite(record.productCost)?record.productCost:undefined,
  unitCost:record.costs/record.quantity,
  margin:record.margin,
  examples:record.examples,
 }:current;

 return <section className="ds-ad-diagnosis" aria-labelledby="ds-ad-diagnosis-title">
  <header>
   <h2 id="ds-ad-diagnosis-title">네이버 광고 예상 손익</h2>
   <div className="ds-ad-diagnosis-import">
    <label htmlFor="ds-ad-diagnosis-select">진단서 불러오기</label>
    <select id="ds-ad-diagnosis-select" value={record?.id??''} onChange={event=>{
     const id=event.target.value;
     setSelected(id);
     const name=usable.find(item=>item.id===id)?.name??current?.name;
     if(name)onImport(name);
    }}>
     <option value="">{current?'현재 진단 결과':usable.length?'저장한 진단서 선택':'저장한 진단서 없음'}</option>
     {usable.map(item=><option key={item.id} value={item.id}>{item.name} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</option>)}
    </select>
    {!signedIn&&<Link href="/store/login/" onClick={saveMemberReturn}>로그인해서 불러오기</Link>}
   </div>
  </header>
  {receipt?<AdEstimate key={JSON.stringify([record?.id??'current',keyword||receipt.name])} diagnosis={receipt} keyword={keyword||receipt.name}/>:<div className="ds-ad-diagnosis-locked">
   <dl className="ds-ad-diagnosis-metrics" aria-hidden="true">
    <div><dt>판매가</dt><dd>••••••</dd></div>
    <div><dt>개당 총 판매 비용</dt><dd>••••••</dd></div>
    <div><dt>개당 이익</dt><dd>••••••</dd></div>
   </dl>
   <div className="ds-ad-diagnosis-unlock">
    <button type="button" className="mp-primary" onClick={onStart}>진단 먼저 해서 더 디테일하게 보기</button>
   </div>
  </div>}
 </section>;
}
