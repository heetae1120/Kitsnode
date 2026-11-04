"use client";
import {ArrowDown,ArrowRight,Printer,Pencil,ShoppingBag,Search,Check} from 'lucide-react';
import {ContainerScroll} from './ui/container-scroll-animation';
import {KeywordBudgetReport} from './keyword-budget-report';
import {marketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {marketingTestBudget} from '@/lib/marketing-test-budget';
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
type Props={name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;onEdit:()=>void;exampleFields?:string[]};
export function BeginnerProfitReport({name,months,input,result:r,onEdit,exampleFields=[]}:Props){
 const testBudget=marketingTestBudget(input);
 const problem=r.margin<=0?'판매가보다 비용이 커요. 가격과 비용을 먼저 바꿔보세요.':r.profitRoom<0?'모두 팔아도 비용을 다 돌려받기 어려워요.':r.cashRoom<0?`준비할 돈이 ${money(-r.cashRoom)} 부족해요.`:'지금은 홍보비로 남는 돈이 없어요.';
 return <article className="mp-story">
  <section id="report-budget" aria-label="쓸 수 있는 홍보비">
   <ContainerScroll titleComponent={<><span className="mp-eyebrow">{name} 판매 계획</span><h1>홍보비는<br/><em>이 안에서 시작하세요.</em></h1><p>상품과 판매 비용을 먼저 뺀 금액이에요.</p></>}>
    <div className="mp-tablet-budget"><div className="mp-story-summary-top"><span>팔려는 수량</span><b>{months}개월 안에 {input.quantity.toLocaleString('ko-KR')}개</b></div>
     <div className="mp-story-flow"><div><span>쓸 수 있는 돈</span><b>{money(input.available)}</b></div><ArrowRight size={18} aria-hidden/><div><span>상품·판매 비용</span><b>{money(r.reserved)}</b></div><ArrowRight size={18} aria-hidden/><div><span>남는 돈</span><b>{money(r.cashRoom)}</b></div></div>
     <div className="mp-story-budget"><span>쓸 수 있는 홍보비 · 최대</span><strong>{money(r.marketing)}</strong><p>{r.marketing>0?'한 번에 쓰지 말고, 조금씩 확인하세요.':problem}</p></div>
     {testBudget&&<aside className="mp-story-suggestion" aria-label="첫 홍보비 제안"><span>처음에는 이만큼</span><h2><strong>{money(testBudget.amount)}</strong>으로 시작해 보세요.</h2><p>최대 금액의 약 10%예요. 효과를 보고 늘리세요.</p><small>성과 예측이 아닌 시작 기준이에요. 이 비용과 고정비를 돌려받으려면 {testBudget.breakEvenUnits.toLocaleString('ko-KR')}개를 팔아야 해요.</small></aside>}

     <p className="mp-story-caption">남는 돈과 모두 팔았을 때의 이익 중 더 적은 금액이 한도예요.{input.marketingBudget!==undefined&&' 정해둔 홍보비도 넘지 않아요.'} 실제로 모두 팔린다는 뜻은 아니에요.</p>
    </div>
   </ContainerScroll>
   <details className="mp-story-details mp-budget-details"><summary>돈이 어떻게 나뉘었나요?</summary><dl className="mp-breakdown">{([['쓸 수 있는 전체 돈',input.available],['상품·판매 비용',r.reserved],['비용을 빼고 남는 돈',r.cashRoom],['모두 팔았을 때 홍보 전 이익',r.profitRoom],['홍보비 최대 금액',r.marketing],['모두 팔았을 때 매출',r.sales],['최대 홍보비 사용 후 이익',r.profit]] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl></details>
  </section>
  <p className="mp-story-scroll"><ArrowDown size={16}/> 아래에서 비용과 검색어를 확인하세요</p>
  <nav className="mp-story-nav" aria-label="보고서 바로가기"><a href="#report-budget">홍보비</a><a href="#report-sales">개당 이익</a><a href="#report-keywords">검색어</a><a href="#report-breakeven">본전 판매량</a></nav>
  <section id="report-sales" className="mp-story-chapter"><div className="mp-story-heading"><span><ShoppingBag size={18}/> 한 개 팔면</span><h2>내 손에<br/><em>얼마가 남을까요?</em></h2></div>
   <div className="mp-story-sale"><div><span>판매가</span><b>{money(input.price)}</b></div><span>−</span><div><span>모든 판매 비용</span><b>{money(r.variable)}</b></div><span>=</span><div><span>한 개당 남는 돈</span><b>{money(r.margin)}</b></div></div>
   <p className="mp-story-caption">홍보비를 쓰기 전 금액이에요.</p>
   <div className="mp-story-limit"><span>한 개를 팔기 위해 쓸 수 있는<br/><b>홍보비 한도</b></span><strong>{money(r.perOrder)}</strong><p>구매 한 건을 만드는 데 이보다 많이 쓰면 손해예요. 고정비가 있으면 수량으로 나눠 뺐어요.</p></div>
   <details className="mp-story-details"><summary>한 개당 비용 보기</summary><dl className="mp-breakdown">{([['상품 구매·제조비',input.cost],['판매 수수료',r.fee],['배송·물류비',input.logistics],['포장·기타 비용',input.packaging],['반품 예상 비용',input.returns],...(r.fixed>0?[['나눠 반영한 고정비',r.fixed/input.quantity]]:[])] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl></details>
  </section>
  <section id="report-keywords" className="mp-story-chapter"><div className="mp-story-heading"><span><Search size={18}/> 검색어 고르기</span><h2>어떤 검색어로<br/><em>홍보할까요?</em></h2><p>내 상품과 맞는지, 클릭 비용은 얼마인지 확인하세요.</p></div><KeywordBudgetReport productName={name} perOrder={r.perOrder} budget={r.marketing} quantity={input.quantity} months={months}/></section>
  <section id="report-breakeven" className="mp-story-chapter"><div className="mp-story-heading"><span>본전 판매량</span><h2>홍보비까지 돌려받으려면<br/><em>몇 개를 팔아야 할까요?</em></h2></div><section className="mp-story-summary mp-breakeven-lower" aria-label="본전을 위한 최소 판매량">{r.breakEvenUnits===null?<><h2>지금 비용으로는<br/>본전을 찾기 어려워요.</h2><p>{problem}</p></>:<><p>홍보비를 최대 {money(r.marketing)} 쓴다면</p><h2>최소 <strong>{r.breakEvenUnits.toLocaleString('ko-KR')}<small>개</small></strong>를 팔아야 본전이에요.</h2>{r.breakEvenUnits>input.quantity&&<p className="mp-story-alert">계획한 수량을 모두 팔아도 부족해요.</p>}<p>안 팔린 재고에 묶인 돈은 아직 돌려받지 못한 돈이에요.</p></>}</section><details className="mp-story-details"><summary>본전은 어떻게 계산했나요?</summary><p>(고정비 + 홍보비 최대 금액) ÷ 한 개당 남는 돈. 소수점은 올려요.</p><p>광고 매출은 광고비의 {r.breakEvenRoas===null?'계산 불가':`${(r.breakEvenRoas/100).toLocaleString('ko-KR',{maximumFractionDigits:2})}배`} 이상이어야 본전이에요. 이 비율을 손익분기 ROAS라고 해요.</p></details></section>
  <section id="report-next" className="mp-story-chapter"><div className="mp-story-heading"><span><Check size={18}/> 다음 할 일</span><h2>작게 시작하고,<br/><em>팔리는지 확인하세요.</em></h2></div><ol className="mp-story-next"><li><b>빠진 비용 확인</b><p>{r.marketing>0?'할인·세금 등 빠진 비용이 있다면 다시 계산하세요.':problem}</p></li><li><b>내 상품에 맞는 검색어 선택</b><p>용량·기능·구매 목적이 맞는 검색어를 고르세요.</p></li><li><b>실제 비용 비교</b><p>쓴 광고비 ÷ 광고로 판 수량이 {money(r.perOrder)} 이내인지 보세요.</p></li></ol></section>
  <footer className="mp-story-footer">{exampleFields.length>0&&<p>참고값이 포함된 계산이에요. 실제 비용을 알면 다시 계산하세요.</p>}<p>계획 수량을 모두 팔고, 주문 한 건에 상품 한 개가 팔린다고 계산했어요. 빠진 비용이 있으면 이익이 줄어요. 매출을 예측하는 결과는 아니에요.</p><div className="mp-actions"><button type="button" className="mp-secondary" onClick={onEdit}><Pencil size={16}/> 입력 바꾸기</button><button type="button" className="mp-primary" onClick={()=>window.print()}><Printer size={16}/> 인쇄 / PDF 저장</button></div></footer>
 </article>;
}
