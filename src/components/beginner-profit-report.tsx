"use client";
import {useCallback,useState} from 'react';
import {ReportEvidenceContext} from './report-evidence-context';
import type {ReportEvidence} from '@/lib/diagnosis-analysis';
import {DiagnosisDownload} from './diagnosis-download';
import {DiagnosisResult} from './diagnosis-result';
import {diagnosisOutcome} from '@/lib/diagnosis-outcome';
import {ReportPriorityContext,type ReportDiagnostic} from './report-priority-context';
import {reportPriority} from '@/lib/report-priority';
import {ArrowRight,Search,Check} from 'lucide-react';
import {ProfitReportPages} from './profit-report-pages';
import {ReportTabletSlides} from './report-tablet-slides';

import {KeywordBudgetReport} from './keyword-budget-report';
import {marketingPlan,salesFundedMarketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
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

type Props={initialPage?:0|1;name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;onEdit:()=>void;onMoreCosts:()=>void;onRequestMonths?:(proceed:()=>void)=>void;exampleFields?:string[]};
export function BeginnerProfitReport({initialPage=0,name,months,input,onEdit,onMoreCosts,onRequestMonths,exampleFields=[]}:Props){
 const r=salesFundedMarketingPlan(input);
 const unitProfit=r.margin-r.fixed/input.quantity;
 const beforeMonths=months<1?onRequestMonths:undefined;
 const [diagnostic,setDiagnostic]=useState<ReportDiagnostic>(null);
 const [evidence,setEvidence]=useState<ReportEvidence>({});
 const [reorderDates,setReorderDates]=useState<ReorderDates>({});
 const updateEvidence=useCallback((next:Partial<ReportEvidence>)=>setEvidence(previous=>({...previous,...next})),[]);
 const priority=reportPriority({margin:unitProfit,perOrder:r.perOrder,exampleCosts:exampleFields.length>0,cost:input.cost,extraCost:input.logistics+input.packaging,diagnostic});
 const outcome=diagnosisOutcome({quantity:input.quantity,months,sales:r.sales,costs:r.reserved,profit:r.profitRoom,marketing:r.marketing,analysis:evidence});
 const stockCost=input.cost*input.quantity;
 const expectedProfit=r.sales-stockCost;
 const extraCosts=r.reserved-stockCost;
 const problem=unitProfit<=0?'판매가보다 비용이 커요. 가격과 비용을 먼저 바꿔보세요.':r.profitRoom<0?'모두 팔아도 비용을 다 돌려받기 어려워요.':'지금은 마케팅비용으로 남는 금액이 없어요.';
 return <ReportEvidenceContext.Provider value={updateEvidence}><ReportPriorityContext.Provider value={setDiagnostic}><article className="mp-story">
  <ProfitReportPages productName={name} initialPage={initialPage} beforeKeywords={beforeMonths} actions={<div className="ds-report-download-stack"><DiagnosisDownload trailingAction={<button type="button" className="mp-primary mp-more-considerations" onClick={onMoreCosts}>이 외에도 고려해야 할 것들 보러가기<ArrowRight size={16}/></button>} report={{name,months,analysis:evidence,price:input.price,quantity:input.quantity,sales:r.sales,costs:r.reserved,profit:r.profitRoom,margin:unitProfit,marketing:r.marketing,breakEven:r.breakEvenUnits,priority:priority.title,action:priority.action,examples:exampleFields.length>0}}/></div>} overview={<>
  <section id="report-funds" aria-label="금액 정리와 재고 계획">
   <div className="ds-open-report">
    <ReportTabletSlides beforeNext={beforeMonths} onBack={onEdit} heading={page=><div className="ds-result-heading"><h1>{reportTitles[page]}</h1>{page===0&&<p>입력한 판매 조건과 비용을 바탕으로 계산한 결과를 확인해보세요.</p>}</div>}><div className="mp-tablet-budget"><dl className="mp-plan-recap" aria-label="판매 계획 합계"><div><dt>총 판매금액</dt><dd>{money(r.sales)}</dd><small>판매가 {money(input.price)} × {input.quantity.toLocaleString('ko-KR')}개</small></div><div><dt>부가비용 포함 총원가</dt><dd>{money(r.reserved)}</dd><small>상품 원가 {money(stockCost)} + 부가비용 {money(extraCosts)}</small></div><div><dt>판매 목표</dt><dd>{input.quantity.toLocaleString('ko-KR')}개</dd><small>{months>0?`${months}개월 안에 전부 판매`:'계획 수량 전량 판매 기준'}</small></div></dl>
     <section className="mp-profit-reality" aria-label="비용을 빼기 전후 전체 이익"><ProfitComparison before={expectedProfit} after={r.profitRoom} extraCosts={extraCosts}/><details className="mp-profit-deductions mp-story-details"><summary>판매 수수료·세부 비용 보기</summary><dl className="mp-breakdown">{([['판매 수수료',r.fee*input.quantity],['배송·물류비',input.logistics*input.quantity],['포장·기타 비용',input.packaging*input.quantity],['반품 예상 비용',input.returns*input.quantity],...(input.fixed>0?[['상세페이지 및 썸네일 비용',input.fixed]]:[]),...(input.certification>0?[['인증 비용',input.certification]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div className="mp-extra-total"><dt>추가로 빠지는 비용</dt><dd>{money(extraCosts)}</dd></div></dl></details><p className="mp-story-caption">계획 수량 전량 판매 기준이며, 마케팅비용과 미입력 비용은 아직 빼지 않았어요.</p></section>

    </div>
  <ReorderTimeline quantity={input.quantity} months={months} dates={reorderDates} onDatesChange={setReorderDates}/>
  <GoalInvitation months={months} profit={r.profitRoom}/>
  </ReportTabletSlides></div></section></>} keywords={<>
  <DiagnosisResult report={{quantity:input.quantity,months,sales:r.sales,costs:r.reserved,profit:r.profitRoom,marketing:r.marketing,analysis:evidence}}/>
  <section id="report-keywords" className="mp-story-chapter"><div className="mp-story-heading"><span><Search size={18}/> 검색어 고르기</span><h2>어떤 검색어로<br/><em>홍보할까요?</em></h2><p>마케팅비용 한도는 계획 수량을 모두 판매한 후의 이익을 기준으로 한 가정이며, 지금 쓸 수 있는 예산이 아니에요. {input.available<stockCost?`입력한 준비 자금은 상품 구매비보다 ${money(stockCost-input.available)} 부족해요. `:''}내 상품과 맞는 검색어와 클릭 비용을 확인하세요.</p></div><KeywordBudgetReport budgetContext={{basis:'sales',available:r.sales,reserved:r.reserved,cashRoom:r.cashRoom,profitRoom:r.profitRoom}} productName={name} perOrder={r.perOrder} budget={r.marketing} quantity={input.quantity} months={months}/></section>
  <section id="report-breakeven" className="mp-story-chapter"><div className="mp-story-heading"><span>본전 판매량</span><h2>마케팅비용까지 돌려받으려면<br/><em>몇 개를 팔아야 할까요?</em></h2></div><section className="mp-story-summary mp-breakeven-lower" aria-label="본전을 위한 최소 판매량">{r.breakEvenUnits===null?<><h2>지금 비용으로는<br/>본전을 찾기 어려워요.</h2><p>{problem}</p></>:<><p>마케팅비용을 최대 {money(r.marketing)} 쓴다면</p><h2>최소 <strong>{r.breakEvenUnits.toLocaleString('ko-KR')}<small>개</small></strong>를 팔아야 본전이에요.</h2>{r.breakEvenUnits>input.quantity&&<p className="mp-story-alert">계획한 수량을 모두 팔아도 부족해요.</p>}</>}</section><details className="mp-story-details"><summary>본전은 어떻게 계산했나요?</summary><p>(고정비 + 마케팅비용 최대 금액) ÷ 한 개당 남는 금액. 소수점은 올려요.</p><p>광고 매출은 광고비의 {r.breakEvenRoas===null?'계산 불가':`${(r.breakEvenRoas/100).toLocaleString('ko-KR',{maximumFractionDigits:2})}배`} 이상이어야 본전이에요. 이 비율을 손익분기 ROAS라고 해요.</p></details></section>
  <section id="report-next" className="mp-story-chapter"><div className="mp-story-heading"><span><Check size={18}/> 가장 먼저 할 일</span><h2>{outcome.status==='positive'?'작게 시작하고, 실제 손익을 다시 확인해보세요':outcome.status==='negative'?'손익을 바꿀 조건부터 다시 확인해보세요':'자료를 확인한 뒤 진단을 이어가세요'}</h2></div><div className="mp-priority-action"><b>{outcome.actions[0]}</b><p>{outcome.actions[1]}</p></div><div className="mp-brand-partner"><span>WITH KITSNODE</span><h3>한 번의 광고보다,<br/>오래가는 브랜드를 함께 만듭니다.</h3><p>킷츠는 이번 진단을 시작으로 상품·수익 구조·광고를 꾸준히 점검하며, 고객이 다시 찾는 브랜드로 성장하는 과정을 함께 돕겠습니다.</p></div></section>
  </>}/>

 </article></ReportPriorityContext.Provider></ReportEvidenceContext.Provider>;
}

