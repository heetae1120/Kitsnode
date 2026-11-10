"use client";
import {ArrowDown,ArrowRight,Printer,Pencil,Search,Check} from 'lucide-react';
import {ProfitReportPages} from './profit-report-pages';
import {ContainerScroll} from './ui/container-scroll-animation';
import {KeywordBudgetReport} from './keyword-budget-report';
import {marketingPlan,salesFundedMarketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {ReorderTimeline} from './reorder-timeline';
const tone=(value:number)=>value<0?'mp-negative':value>0?'mp-positive':'mp-neutral';
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
type Props={name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;onEdit:()=>void;onMoreCosts:()=>void;exampleFields?:string[]};
export function BeginnerProfitReport({name,months,input,onEdit,onMoreCosts,exampleFields=[]}:Props){
 const r=salesFundedMarketingPlan(input);
 const stockCost=input.cost*input.quantity;
 const expectedProfit=r.sales-stockCost;
 const extraCosts=r.reserved-stockCost;
 const problem=r.margin<=0?'판매가보다 비용이 커요. 가격과 비용을 먼저 바꿔보세요.':r.profitRoom<0?'모두 팔아도 비용을 다 돌려받기 어려워요.':'지금은 홍보비로 남는 금액이 없어요.';
 return <article className="mp-story">
  <ProfitReportPages footer={<footer className="mp-story-footer">{exampleFields.length>0&&<p>참고값이 포함된 계산이에요. 실제 비용을 알면 다시 계산하세요.</p>}<p>계획 수량을 모두 팔고, 주문 한 건에 상품 한 개가 팔린다고 계산했어요. 빠진 비용이 있으면 이익이 줄어요. 매출을 예측하는 결과는 아니에요.</p><div className="mp-actions"><button type="button" className="mp-secondary" onClick={onEdit}><Pencil size={16}/> 입력 바꾸기</button><button type="button" className="mp-primary" onClick={()=>window.print()}><Printer size={16}/> 인쇄 / PDF 저장</button><button type="button" className="mp-primary" onClick={onMoreCosts}>다음 · 더 필요한 비용<ArrowRight size={16}/></button></div></footer>} overview={<>
  <section id="report-funds" aria-label="총매출과 비용">
   <ContainerScroll titleComponent={<h1>진단 결과를 확인해보세요</h1>}>
    <div className="mp-tablet-budget"><dl className="mp-plan-recap" aria-label="판매 계획 합계"><div><dt>총 판매금액</dt><dd>{money(r.sales)}</dd><small>판매가 {money(input.price)} × {input.quantity.toLocaleString('ko-KR')}개</small></div><div><dt>총 상품 원가</dt><dd>{money(stockCost)}</dd><small>원가 {money(input.cost)} × {input.quantity.toLocaleString('ko-KR')}개</small></div><div><dt>판매 목표</dt><dd>{input.quantity.toLocaleString('ko-KR')}개</dd><small>{months}개월 안에 전부 판매</small></div></dl>
     <section className="mp-profit-reality" aria-label="비용을 빼기 전후 전체 이익"><div className="mp-profit-before"><span>원가만 빼면, 이만큼 남을 것 같아요</span><strong className={tone(expectedProfit)}>{money(expectedProfit)}</strong><small>총 판매금액 − 총 상품 원가</small></div><div className="mp-profit-deductions"><h2>그런데, 이런 비용도 나가요</h2><dl className="mp-breakdown">{([['판매 수수료',r.fee*input.quantity],['배송·물류비',input.logistics*input.quantity],['포장·기타 비용',input.packaging*input.quantity],['반품 예상 비용',input.returns*input.quantity],...(r.fixed>0?[['전체 고정비',r.fixed]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}<div className="mp-extra-total"><dt>추가로 빠지는 비용</dt><dd>{money(extraCosts)}</dd></div></dl></div><ArrowDown size={22} className="mp-profit-arrow" aria-hidden/><div className="mp-profit-after"><span>이 비용까지 빼면, 남는 이익은</span><strong className={tone(r.profitRoom)}>{money(r.profitRoom)}</strong><small>{money(expectedProfit)} − {money(extraCosts)}</small></div><p className="mp-story-caption">계획한 수량을 모두 팔았을 때예요. 입력한 비용만 반영했고, 홍보비는 아직 빼지 않았어요.</p></section>
     <div className="mp-funds-after"><h2>총매출에서 비용을 빼면?</h2><div className="mp-story-flow"><div><span>총 매출</span><b>{money(r.sales)}</b></div><ArrowRight size={18} aria-hidden/><div><span>상품·판매 비용</span><b>{money(r.reserved)}</b></div><ArrowRight size={18} aria-hidden/><div><span>홍보 전 남는 이익</span><b className={tone(r.profitRoom)}>{money(r.profitRoom)}</b></div></div><p className="mp-story-caption">계획한 수량을 모두 판매한 총매출에서 상품·판매 비용을 뺀 금액이에요. 판매 전 보유 예산과는 달라요.</p></div>
   <details className="mp-story-details mp-budget-details"><summary>전체 금액 자세히 보기</summary><dl className="mp-breakdown">{([['총 매출',r.sales],['상품·판매 비용',r.reserved],['비용을 빼고 남는 이익',r.profitRoom],['총매출 기준 홍보비 한도',r.marketing]] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd className={tone(value)}>{money(value)}</dd></div>)}</dl></details>
    </div>
   </ContainerScroll>

  </section>
  <section id="report-sales" className="mp-story-chapter mp-unit-summary" aria-labelledby="unit-profit-title">
   <h2 id="unit-profit-title">한 개 팔면 내 손에 얼마가 남을까요?</h2>
   <div className="mp-story-sale"><div><span>판매가</span><b>{money(input.price)}</b></div><span>−</span><div><span>모든 판매 비용</span><b>{money(r.variable)}</b></div><span>=</span><div><span>홍보 전 개당 이익</span><b className={tone(r.margin)}>{money(r.margin)}</b></div></div>
   <div className="mp-unit-ad-limit"><span>한 건당 홍보비 한도</span><strong className={tone(r.perOrder)}>{money(r.perOrder)}</strong></div>
   <p className="mp-story-caption">구매 한 건의 광고비가 이 한도를 넘으면 손해예요.{r.fixed>0?' 고정비를 판매 수량으로 나눠 한도에서 뺐어요.':''}</p>
   <details className="mp-story-details"><summary>한 개당 비용 보기</summary><dl className="mp-breakdown">{([['상품 구매·제조비',input.cost],['판매 수수료',r.fee],['배송·물류비',input.logistics],['포장·기타 비용',input.packaging],['반품 예상 비용',input.returns],...(r.fixed>0?[['나눠 반영한 고정비',r.fixed/input.quantity]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd className={tone(value)}>{money(value)}</dd></div>)}</dl></details>
  </section>
  <ReorderTimeline quantity={input.quantity} months={months}/>
  <section id="report-budget" className="mp-story-chapter mp-goal-invitation"><h2>당신은 <em>{months}개월</em> 동안<br/><strong>{money(r.profitRoom)}</strong>을 벌려고 하는 거예요.</h2><p>이게 가능한지, 이것도 어려운지는 이제 확인해볼까요?</p></section>
  </>} keywords={<>
  <section id="report-keywords" className="mp-story-chapter"><div className="mp-story-heading"><span><Search size={18}/> 검색어 고르기</span><h2>어떤 검색어로<br/><em>홍보할까요?</em></h2><p>내 상품과 맞는지, 클릭 비용은 얼마인지 확인하세요.</p></div><KeywordBudgetReport budgetContext={{basis:'sales',available:r.sales,reserved:r.reserved,cashRoom:r.cashRoom,profitRoom:r.profitRoom}} productName={name} perOrder={r.perOrder} budget={r.marketing} quantity={input.quantity} months={months}/></section>
  <section id="report-breakeven" className="mp-story-chapter"><div className="mp-story-heading"><span>본전 판매량</span><h2>홍보비까지 돌려받으려면<br/><em>몇 개를 팔아야 할까요?</em></h2></div><section className="mp-story-summary mp-breakeven-lower" aria-label="본전을 위한 최소 판매량">{r.breakEvenUnits===null?<><h2>지금 비용으로는<br/>본전을 찾기 어려워요.</h2><p>{problem}</p></>:<><p>홍보비를 최대 {money(r.marketing)} 쓴다면</p><h2>최소 <strong>{r.breakEvenUnits.toLocaleString('ko-KR')}<small>개</small></strong>를 팔아야 본전이에요.</h2>{r.breakEvenUnits>input.quantity&&<p className="mp-story-alert">계획한 수량을 모두 팔아도 부족해요.</p>}<p>안 팔린 재고에 묶인 금액은 아직 돌려받지 못한 금액이에요.</p></>}</section><details className="mp-story-details"><summary>본전은 어떻게 계산했나요?</summary><p>(고정비 + 홍보비 최대 금액) ÷ 한 개당 남는 금액. 소수점은 올려요.</p><p>광고 매출은 광고비의 {r.breakEvenRoas===null?'계산 불가':`${(r.breakEvenRoas/100).toLocaleString('ko-KR',{maximumFractionDigits:2})}배`} 이상이어야 본전이에요. 이 비율을 손익분기 ROAS라고 해요.</p></details></section>
  <section id="report-next" className="mp-story-chapter"><div className="mp-story-heading"><span><Check size={18}/> 다음 할 일</span><h2>작게 시작하고,<br/><em>팔리는지 확인하세요.</em></h2></div><ol className="mp-story-next"><li><b>빠진 비용 확인</b><p>{r.marketing>0?'할인·세금 등 빠진 비용이 있다면 다시 계산하세요.':problem}</p></li><li><b>내 상품에 맞는 검색어 선택</b><p>용량·기능·구매 목적이 맞는 검색어를 고르세요.</p></li><li><b>실제 비용 비교</b><p>쓴 광고비 ÷ 광고로 판 수량이 {money(r.perOrder)} 이내인지 보세요.</p></li></ol></section>
  </>}/>

 </article>;
}
