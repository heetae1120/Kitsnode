'use client';

import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {keywordEconomics} from '@/lib/keyword-budget';
import {saveMemberReturn} from '@/lib/member-return';
import {useSavedDiagnoses} from './diagnosis-download';

export type AdDiagnosis={name:string;price:number;productCost?:number;unitCost:number;margin:number;examples:boolean};
const money=(value:number)=>Math.round(value).toLocaleString('ko-KR')+'원';

export function AdEstimate({diagnosis,keyword,reference}:{diagnosis:AdDiagnosis;keyword:string;reference?:{cpc:number;source:string}}){
 const [clickCost,setClickCost]=useState<string|null>(null);
 const [conversion,setConversion]=useState('2');
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
 return <section className="ds-ad-diagnosis ds-ad-estimate" aria-label="키워드별 광고 예상 손익">
  <h4>‘{keyword}’ 광고 예상 손익</h4>
  <p>‘{diagnosis.name}’ 진단서의 개당 이익 {money(diagnosis.margin)}을 적용했어요. 구매 1건당 상품 1개 판매를 가정해요.</p>
  <div className="ds-ad-diagnosis-inputs">
   <label>클릭당 비용 (원)<input type="number" min="1" step="any" inputMode="decimal" value={cpc} onChange={event=>setClickCost(event.target.value)}/></label>
   <label>가정 구매 전환율 (%)<input type="number" min="0.01" max="100" step="any" inputMode="decimal" value={conversion} onChange={event=>setConversion(event.target.value)}/></label>
  </div>
  {reference&&clickCost===null&&<p>{reference.source}</p>}
  {!reference&&<p>이 검색어의 참고 클릭 비용을 확인하지 못했어요. 확인한 금액이 있다면 직접 입력해 보세요.</p>}
  {reference&&clickCost!==null&&<button className="mp-secondary" type="button" onClick={()=>setClickCost(null)}>검색 결과의 비용 적용</button>}
  <div className="ds-ad-diagnosis-verdict" data-status={status} aria-live="polite">
   <strong>{verdict[status]}</strong>
   {limit!==null&&diagnosis.margin>0&&<p>이 전환율에서 클릭당 {limit.toLocaleString('ko-KR',{maximumFractionDigits:2})}원까지 광고비를 감당할 수 있어요.</p>}
   {estimate&&<p>구매 1건당 예상 광고비 {money(estimate.cpa)} · 광고 후 예상 손익 {money(estimate.contribution)}</p>}
  </div>
 </section>;
}

export function AdDiagnosisCheck({current,onImport,onStart,children}:{current:AdDiagnosis|null;onImport:(name:string)=>void;onStart:()=>void;children:(diagnosis:AdDiagnosis|null)=>ReactNode}){
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

 return <><section className="ds-ad-diagnosis" aria-labelledby="ds-ad-diagnosis-title">
  <header>
   <h2 id="ds-ad-diagnosis-title">광고 진단에 사용할 판매 조건</h2>
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
  {receipt?<>
   <h3>{receipt.name}</h3>
   <dl className="ds-ad-diagnosis-metrics">
    <div><dt>판매가</dt><dd>{money(receipt.price)}</dd></div>
    {receipt.productCost!==undefined&&<div><dt>상품 원가</dt><dd>{money(receipt.productCost)}</dd></div>}
    <div><dt>개당 총 판매 비용</dt><dd>{money(receipt.unitCost)}</dd></div>
    <div><dt>개당 이익</dt><dd>{money(receipt.margin)}</dd></div>
   </dl>
   {receipt.examples&&<p>진단서에 참고 비용이 포함되어 있어요.</p>}
   <p>아래에서 키워드를 분석하면 검색 결과에 광고 예상 손익이 표시돼요.</p>
  </>:<div className="ds-ad-diagnosis-locked">
   <dl className="ds-ad-diagnosis-metrics" aria-hidden="true">
    <div><dt>판매가</dt><dd>••••••</dd></div>
    <div><dt>개당 총 판매 비용</dt><dd>••••••</dd></div>
    <div><dt>개당 이익</dt><dd>••••••</dd></div>
   </dl>
   <div className="ds-ad-diagnosis-unlock">
    <button type="button" className="mp-primary" onClick={onStart}>진단 먼저 해서 더 디테일하게 보기</button>
   </div>
  </div>}
 </section>{children(receipt)}</>;
}
