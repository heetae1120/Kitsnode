"use client";
import {useState} from 'react';
import {DiagnosisDownload} from './diagnosis-download';
import {reportPriority} from '@/lib/report-priority';
import {ArrowRight} from 'lucide-react';
import {ProfitReportPages} from './profit-report-pages';
import {ReportTabletSlides} from './report-tablet-slides';

import {salesFundedMarketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {ReorderTimeline,type ReorderDates} from './reorder-timeline';
import {GoalInvitation} from './goal-invitation';
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
const reportTitles=['금액정리','재고 스케줄러','판매 목표'];

function ProfitComparison({before,after,extraCosts}:{before:number;after:number;extraCosts:number}){
 const minimum=Math.min(0,before,after);
 const maximum=Math.max(0,before,after);
 const range=(maximum-minimum)||1;
 const zero=-minimum/range*100;
 const rows=[
  {label:'원가만 뺀 원래 이익',value:before},
  {label:'추가 비용을 뺀 실제 이익',value:after},
 ];
 return <figure className="ds-profit-chart">
  <figcaption><b>전체 이익 비교</b><small>0원 기준 · 손실은 왼쪽, 이익은 오른쪽</small></figcaption>
  {rows.map(({label,value},index)=><div key={label} className="ds-profit-row">
   <div className="ds-profit-label"><span>{label}</span><strong className={value<0?'is-loss':undefined}>{money(value)}</strong></div>
   <div className="ds-profit-track" aria-hidden="true">
    <span className={`ds-profit-bar${index===1?' is-actual':''}${value<0?' is-loss':''}`} style={{left:Math.min((value-minimum)/range*100,zero)+'%',width:Math.abs(value)/range*100+'%'}}/>
    <span className="ds-profit-zero" style={{left:zero+'%'}}/>
   </div>
  </div>)}
  <p className="ds-profit-gap">추가 비용으로 줄어든 이익 <strong>{money(extraCosts)}</strong></p>
 </figure>;
}

type Props={initialAdIntro?:boolean;initialSlide?:0|2;name:string;months:number;input:MarketingPlanInput;onEdit:()=>void;onMoreCosts:()=>void;onAdCheck:(productName:string)=>void;onRequestMonths?:(proceed:()=>void)=>void;exampleFields?:string[]};
export function BeginnerProfitReport({initialAdIntro,initialSlide,name,months,input,onEdit,onMoreCosts,onAdCheck,onRequestMonths,exampleFields=[]}:Props){
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
   trailingAction={<button type="button" className="mp-primary mp-more-considerations" onClick={onMoreCosts}>이 외에도 고려해야 할 것들 보러가기<ArrowRight size={16}/></button>}
  />
 </div>:null;
 return <article className="mp-story">
  <ProfitReportPages productName={name} initialAdIntro={initialAdIntro} onAdCheck={()=>onAdCheck(name)} overview={showAdIntro=>
  <section id="report-funds" aria-label="금액 정리와 재고 계획">
   <div className="ds-open-report">
    <ReportTabletSlides
     initialPage={initialSlide} beforeNext={beforeMonths} onBack={onEdit} onFinish={showAdIntro} finalActions={finalActions}
    heading={page=><div className="ds-result-heading"><h1>{reportTitles[page]}</h1>{page===0&&<p>입력한 판매 조건과 비용을 바탕으로 계산한 결과를 확인해보세요.</p>}</div>}>
     <div className="mp-tablet-budget"><dl className="mp-plan-recap" aria-label="판매 계획 합계"><div><dt>총 판매금액</dt><dd>{money(r.sales)}</dd><small>판매가 {money(input.price)} × {input.quantity.toLocaleString('ko-KR')}개</small></div><div><dt>부가비용 포함 총원가</dt><dd>{money(r.reserved)}</dd><small>상품 원가 {money(stockCost)} + 부가비용 {money(extraCosts)}</small></div><div><dt>판매 목표</dt><dd>{input.quantity.toLocaleString('ko-KR')}개</dd><small>{months>0?`${months}개월 안에 전부 판매`:'계획 수량 전량 판매 기준'}</small></div></dl>
     <section className="mp-profit-reality" aria-label="비용을 빼기 전후 전체 이익"><ProfitComparison before={expectedProfit} after={r.profitRoom} extraCosts={extraCosts}/><details className="mp-profit-deductions mp-story-details"><summary>판매 수수료·세부 비용 보기</summary><dl className="mp-breakdown">{([['판매 수수료',r.fee*input.quantity],['배송·물류비',input.logistics*input.quantity],['포장·기타 비용',input.packaging*input.quantity],['반품 예상 비용',input.returns*input.quantity],...(input.fixed>0?[['상세페이지 및 썸네일 비용',input.fixed]]:[]),...(input.certification>0?[['인증 비용',input.certification]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div className="mp-extra-total"><dt>추가로 빠지는 비용</dt><dd>{money(extraCosts)}</dd></div></dl></details><p className="mp-story-caption">계획 수량 전량 판매 기준이며, 마케팅비용과 미입력 비용은 아직 빼지 않았어요.</p></section>

    </div>
  <ReorderTimeline quantity={input.quantity} months={months} dates={reorderDates} onDatesChange={setReorderDates}/>
  <GoalInvitation months={months} profit={r.profitRoom}/>
  </ReportTabletSlides></div></section>}/>
 </article>;
}

