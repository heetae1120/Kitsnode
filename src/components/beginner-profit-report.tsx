"use client";
import { ArrowDown, ArrowRight, Printer, Pencil, Wallet, ShoppingBag, Search, Check } from "lucide-react";
import { ContainerScroll } from "./ui/container-scroll-animation";
import { KeywordBudgetReport } from "./keyword-budget-report";
import { marketingPlan, type MarketingPlanInput } from "@/lib/marketing-plan";

const money = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;
type Props = { name: string; input: MarketingPlanInput; result: ReturnType<typeof marketingPlan>; onEdit: () => void };

export function BeginnerProfitReport({ name, input, result: r, onEdit }: Props) {
  const ready = r.marketing > 0;
  const problem = r.margin <= 0 ? "한 개를 팔아도 비용을 회수하기 어려워요. 판매가와 원가부터 다시 확인해 주세요." : r.profitRoom < 0 ? "준비한 상품을 모두 팔아도 고정비를 회수하기 어려워요." : r.cashRoom < 0 ? `판매 준비에 ${money(-r.cashRoom)}이 더 필요해요.` : "현재 비용에서는 광고비로 쓸 수 있는 여유가 없어요.";
  return <article className="mp-story">
    <ContainerScroll titleComponent={<><span className="mp-eyebrow">내 상품, 숫자로 쉽게 알아보기</span><h1>{name},<br />{ready ? <>광고를 시작하기 전에<br /><em>이 숫자부터 확인하세요.</em></> : <>광고 전에<br /><em>비용부터 점검해 볼까요?</em></>}</h1><p>어려운 계산은 접어두세요.<br />얼마까지 쓰고, 몇 개를 팔아야 하는지 알려드릴게요.</p></>}>
      <section className="mp-story-summary" aria-label="본전을 위한 최소 판매량">
        <div className="mp-story-summary-top"><span>나의 판매 계획</span><b>{input.quantity.toLocaleString("ko-KR")}개</b></div>
        {r.breakEvenUnits === null ? <><p>지금 가격과 비용으로는</p><h2>팔아도 본전을<br />찾기 어려워요.</h2><p>{problem}</p></> : <><p>광고비를 최대 <b>{money(r.marketing)}</b> 쓴다면</p><h2>최소 <strong>{r.breakEvenUnits.toLocaleString("ko-KR")}<small>개</small></strong>를 팔아야 본전이에요.</h2><p>상품 비용과 고정비, 이 광고비까지 회수하는 판매 개수예요.</p>{r.breakEvenUnits > input.quantity && <p className="mp-story-alert">계획한 수량을 모두 팔아도 본전에 도달하지 못해요.</p>}</>}
        <div className="mp-story-summary-bottom"><span>한 개 판매로 광고 전에 남는 돈<b>{money(r.margin)}</b></span><span>이번 계획의 광고비 최대 한도<b>{money(r.marketing)}</b></span></div>
      </section>
    </ContainerScroll>
    <p className="mp-story-scroll"><ArrowDown size={16} /> 아래로 내려가며 하나씩 알아보세요</p>
    <nav className="mp-story-nav" aria-label="보고서 바로가기"><a href="#report-budget">01 광고비</a><a href="#report-sales">02 판매 목표</a><a href="#report-keywords">03 검색어</a><a href="#report-next">04 다음 행동</a></nav>

    <section id="report-budget" className="mp-story-chapter"><div className="mp-story-heading"><span><Wallet size={18}/> 01 · 쓸 수 있는 광고비</span><h2>광고비는<br /><em>여기까지 쓸 수 있어요.</em></h2><p>상품을 준비하는 데 필요한 돈을 먼저 빼고 계산했어요.</p></div>
      <div className="mp-story-budget"><span>이번 판매 계획의 광고비 최대 한도</span><strong>{money(r.marketing)}</strong><p>{ready ? "한 번에 다 쓰는 예산이 아니라, 넘지 말아야 할 선이에요." : problem}</p></div>
      <div className="mp-story-flow"><div><span>준비한 전체 자금</span><b>{money(input.available)}</b></div><ArrowRight aria-hidden size={18}/><div><span>먼저 챙길 상품·부가비용</span><b>{money(r.reserved)}</b></div><ArrowRight aria-hidden size={18}/><div><span>비용을 빼고 남는 자금</span><b>{money(r.cashRoom)}</b></div></div>
      <p className="mp-story-caption">남은 자금이 전부 광고비는 아니에요. 계획 수량을 모두 팔았을 때의 이익{input.marketingBudget !== undefined ? '과 입력한 마케팅 예정 비용' : ''}도 함께 따져, 가장 작은 금액으로 제한했어요. 매출과 성과를 보장하는 금액은 아니에요.</p>
      <details className="mp-story-details"><summary>전체 자금 계산 자세히 보기</summary><dl className="mp-breakdown">{([['총 가용비용',input.available],...(input.marketingBudget!==undefined?[['구매 예정 비용',input.purchaseBudget!],['마케팅 예정 비용',input.marketingBudget]]:[]),['먼저 확보할 상품·부가비용',r.reserved],['비용 확보 후 자금 여유',r.cashRoom],['전량 판매 시 손익상 광고비 한도',r.profitRoom],['최종 마케팅 지출 상한',r.marketing],['전량 판매 시 매출',r.sales],['상한만큼 광고 집행 후 예상 이익',r.profit]] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl></details>
    </section>

    <section id="report-sales" className="mp-story-chapter"><div className="mp-story-heading"><span><ShoppingBag size={18}/> 02 · 팔아야 할 수량</span><h2>한 개 팔 때 남는 돈이<br /><em>광고비의 기준이 돼요.</em></h2><p>상품 한 개를 파는 데 광고비를 얼마나 써도 되는지 살펴보세요.</p></div>
      <div className="mp-story-sale"><div><span>상품 한 개 판매가</span><b>{money(input.price)}</b></div><span>−</span><div><span>원가 + 수수료 + 개당 비용</span><b>{money(r.variable)}</b></div><span>=</span><div><span>광고 전에 남는 돈</span><b>{money(r.margin)}</b></div></div>
      <div className="mp-story-limit"><span>고정비까지 나눠 반영한<br /><b>판매 1건당 광고비 한도</b></span><strong>{money(r.perOrder)}</strong><p>예를 들어 한 건의 구매를 만드는 데 이 금액보다 광고비를 많이 쓰면, 이번 판매 계획에서는 손실이 생겨요.</p></div>
      <p className="mp-story-caption">본전 판매량은 {r.breakEvenUnits===null?'현재 구조로 계산할 수 없어요.':`${r.breakEvenUnits.toLocaleString('ko-KR')}개예요. 판매되지 않은 재고에 묶인 돈까지 회수했다는 뜻은 아니에요.`}</p>
      <details className="mp-story-details"><summary>상품 비용과 본전 계산 자세히 보기</summary><dl className="mp-breakdown">{([['판매가',input.price],['상품 원가',input.cost],['플랫폼·결제 수수료',r.fee],['물류·배송비',input.logistics],['포장·기타 판매비',input.packaging],['반품·교환 예상비',input.returns],['고정비 배분 (인증비 포함)',r.fixed/input.quantity],['판매 1건당 광고비 한도',r.perOrder]] as [string,number][]).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl><p>본전 판매량 = (전체 고정비 + 광고비 최대 한도) ÷ 광고 전 개당 여유 금액, 올림. 상품 원가는 판매한 수량만큼 비용으로 계산해요.</p><p>손익분기 ROAS: {r.breakEvenRoas===null?'계산 불가':`${r.breakEvenRoas.toLocaleString('ko-KR',{maximumFractionDigits:1})}%`}. 광고 매출이 광고비의 {r.breakEvenRoas===null?'—':(r.breakEvenRoas/100).toLocaleString('ko-KR',{maximumFractionDigits:2})}배는 되어야 하는 기준이에요.</p></details>
    </section>

    <section id="report-keywords" className="mp-story-chapter"><div className="mp-story-heading"><span><Search size={18}/> 03 · 광고에 쓸 검색어</span><h2>많이 찾는 검색어,<br /><em>광고비도 괜찮을까요?</em></h2><p>입력한 품목에서 검색어를 찾아 비교해 드려요.<br />먼저 클릭 한 번에 드는 돈을 보고, 내 상품과 맞는 후보를 골라보세요.</p></div><KeywordBudgetReport productName={name} perOrder={r.perOrder} budget={r.marketing}/></section>

    <section id="report-next" className="mp-story-chapter"><div className="mp-story-heading"><span><Check size={18}/> 04 · 이제 할 일</span><h2>처음부터 크게 쓰기보다,<br /><em>작게 확인하고 늘려보세요.</em></h2></div><ol className="mp-story-next"><li><b>비용부터 다시 확인해요</b><p>{ready?'수수료·반품·할인·세금처럼 빠뜨린 비용이 있으면 계산을 수정하세요.':problem}</p></li><li><b>상품에 맞는 검색어를 골라요</b><p>검색량이나 낮은 입찰가만 보지 말고 용량·기능·고객의 구매 목적이 맞는지 확인하세요.</p></li><li><b>실제 판매 비용과 비교해요</b><p>사용한 광고비 ÷ 광고로 판매한 수량을 계산해, 판매 1건당 광고비 한도 {money(r.perOrder)}과 비교하세요.</p></li></ol></section>
    <footer className="mp-story-footer"><p>계획 수량이 모두 판매되고 판매 1건이 상품 1개인 경우예요. 입력한 비용만 반영하며, 누락된 비용이 있으면 결과가 달라져요. 광고 매출·전환율을 예측하지 않아요. 금액은 원 단위 반올림, 지출 상한은 내림 처리해요.</p><div className="mp-actions"><button type="button" className="mp-secondary" onClick={onEdit}><Pencil size={16}/> 입력 수정</button><button type="button" className="mp-primary" onClick={()=>window.print()}><Printer size={16}/> 인쇄 / PDF 저장</button></div></footer>
  </article>;
}
