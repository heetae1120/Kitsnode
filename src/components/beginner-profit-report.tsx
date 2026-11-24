"use client";
import {useState} from 'react';
import {DiagnosisDownload} from './diagnosis-download';
import {reportPriority} from '@/lib/report-priority';
import {ProfitReportPages} from './profit-report-pages';
import {ReportTabletSlides} from './report-tablet-slides';

import {salesFundedMarketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {ReorderTimeline,type ReorderDates} from './reorder-timeline';
import {GoalInvitation} from './goal-invitation';
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
const reportTitles=['예상 손익','재고 일정','판매 계획'];

function ProfitComparison({before,after,extraCosts}:{before:number;after:number;extraCosts:number}){
 const minimum=Math.min(0,before,after);
 const maximum=Math.max(0,before,after);
 const range=(maximum-minimum)||1;
 const zero=-minimum/range*100;
 const rows=[
  {label:'상품 원가만 반영',value:before},
  {label:'추가 비용까지 반영',value:after},
 ];
 return <figure className="ds-profit-chart">
  <figcaption><b>추가 비용 전후 손익</b><small>0원 기준 · 왼쪽 손실, 오른쪽 이익</small></figcaption>
  {rows.map(({label,value},index)=><div key={label} className="ds-profit-row">
   <div className="ds-profit-label"><span>{label}</span><strong className={value<0?'is-loss':undefined}>{money(value)}</strong></div>
   <div className="ds-profit-track" aria-hidden="true">
    <span className={`ds-profit-bar${index===1?' is-actual':''}${value<0?' is-loss':''}`} style={{left:Math.min((value-minimum)/range*100,zero)+'%',width:Math.abs(value)/range*100+'%'}}/>
    <span className="ds-profit-zero" style={{left:zero+'%'}}/>
   </div>
  </div>)}
  <p className="ds-profit-gap">추가 비용 합계 <strong>{money(extraCosts)}</strong></p>
 </figure>;
}

type Props={initialAdIntro?:boolean;initialSlide?:0|2;name:string;months:number;input:MarketingPlanInput;onEdit:()=>void;onAdCheck:(productName:string)=>void;onRequestMonths?:(proceed:()=>void)=>void;exampleFields?:string[]};
export function BeginnerProfitReport({initialAdIntro,initialSlide,name,months,input,onEdit,onAdCheck,onRequestMonths,exampleFields=[]}:Props){
 const r=salesFundedMarketingPlan(input);
 const unitProfit=r.margin-r.fixed/input.quantity;
 const beforeMonths=months<1?onRequestMonths:undefined;
 const [reorderDates,setReorderDates]=useState<ReorderDates>({});
 const priority=reportPriority({margin:unitProfit,perOrder:r.perOrder,exampleCosts:exampleFields.length>0,cost:input.cost,extraCost:input.logistics+input.packaging,diagnostic:null});
 const stockCost=input.cost*input.quantity;
 const expectedProfit=r.sales-stockCost;
 const extraCosts=r.reserved-stockCost;
 const finalActions=months>0?<div className="ds-report-download-stack">
  <DiagnosisDownload
   report={{name,months,price:input.price,quantity:input.quantity,sales:r.sales,costs:r.reserved,profit:r.profitRoom,margin:unitProfit,marketing:r.marketing,breakEven:r.breakEvenUnits,priority:priority.title,action:priority.action,examples:exampleFields.length>0}}
  />
 </div>:null;
 return <article className="mp-story">
  <ProfitReportPages productName={name} months={months} initialAdIntro={initialAdIntro} onAdCheck={()=>onAdCheck(name)} overview={showAdIntro=>
  <section id="report-funds" aria-label="금액 정리와 재고 계획">
   <div className="ds-open-report">
    <ReportTabletSlides
     initialPage={initialSlide} beforeNext={beforeMonths} onBack={onEdit} onFinish={showAdIntro} finalActions={finalActions}
    heading={page=><div className="ds-result-heading"><h1>{reportTitles[page]}</h1></div>}>
     <div className="mp-tablet-budget">
      <section className="sd-result-lead" aria-label="광고비 반영 전 손익">
       <p>예상 {r.profitRoom<0?'손실':r.profitRoom>0?'이익':'손익'} · 광고비 반영 전</p>
       <strong className={r.profitRoom<0?'is-loss':undefined}>{money(r.profitRoom)}</strong>
       <small>{input.quantity.toLocaleString('ko-KR')}개를 모두 판매하고 입력한 비용을 차감한 금액이에요.</small>
      </section>
      <dl className="mp-plan-recap" aria-label="판매 구조">
       <div><dt>예상 매출</dt><dd>{money(r.sales)}</dd><small>{money(input.price)} × {input.quantity.toLocaleString('ko-KR')}개</small></div>
       <div><dt>총 판매 비용</dt><dd>{money(r.reserved)}</dd><small>상품 원가와 추가 비용 합계</small></div>
       <div><dt>상품 1개당 손익</dt><dd>{money(unitProfit)}</dd><small>광고비 반영 전</small></div>
      </dl>
      <section className="mp-profit-reality" aria-label="추가 비용 전후 손익 비교">
       <ProfitComparison before={expectedProfit} after={r.profitRoom} extraCosts={extraCosts}/>
       <details className="mp-profit-deductions mp-story-details"><summary>비용 항목별 금액 보기</summary><dl className="mp-breakdown">{([['상품 원가',stockCost],['판매 수수료',r.fee*input.quantity],['배송·물류비',input.logistics*input.quantity],['포장·기타 비용',input.packaging*input.quantity],['예상 반품비',input.returns*input.quantity],...(input.fixed>0?[['상세페이지·썸네일 제작비',input.fixed]]:[]),...(input.certification>0?[['인증 비용',input.certification]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl></details>
      </section>
      <section className="sd-result-priority" aria-label="우선 점검">
       <h2>{r.profitRoom<=0||exampleFields.length>0?priority.title:'광고에 쓸 검색어를 확인하세요'}</h2>
       <p>{r.profitRoom<=0||exampleFields.length>0?priority.action:'검색량과 클릭당 비용을 살펴보면 광고비를 가늠할 수 있어요.'}</p>
       {exampleFields.length>0&&<small>참고값을 사용한 항목이 있어요. 실제 비용이 확인되면 다시 계산해 보세요.</small>}
      </section>

    </div>
  <ReorderTimeline quantity={input.quantity} months={months} dates={reorderDates} onDatesChange={setReorderDates}/>
  <GoalInvitation months={months} profit={r.profitRoom} quantity={input.quantity}/>
  </ReportTabletSlides></div></section>}/>
 </article>;
}

