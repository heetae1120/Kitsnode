import {keywordGoalDiagnostics,type GoalBudgetContext} from '@/lib/keyword-goal';
import {formatRange,type CountRange} from '@/lib/naver-keywords';
const n=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:2});
const requiredPercent=(v:number)=>n(Math.ceil(v*100)/100);
const money=(v:number)=>`${Math.ceil(v).toLocaleString('ko-KR')}원`;
export function KeywordGoalCheck({cpc,perOrder,budget,quantity,months,cvr,volume,device,budgetContext,compact=false}:{cpc:number;perOrder:number;budget:number;quantity:number;months:number;cvr:number;volume:CountRange|null;device:string;budgetContext?:GoalBudgetContext;compact?:boolean}){
 const diagnostic=keywordGoalDiagnostics({cpc,perOrder,budget,quantity,months,cvr,monthlySearches:volume?.max??null},budgetContext);
 if(!diagnostic)return <p className="mp-keyword-over">구매 비율을 0% 초과~100%로 입력하면 목표를 계산해요.</p>;
 const g=diagnostic.goal;
 const title={loss:'이 조건으로 목표를 채우면 손해예요',both:'예산과 검색량 모두 부족해요',budget:'이 예산으로는 목표 수량이 부족해요',demand:'이 검색어 하나로는 수량이 부족해요',unknown:'검색량 확인이 더 필요해요',conditional:'계산 조건은 맞아요 · 실제 클릭 확인 필요'}[g.status];
 if(compact){
  const risky=g.loss||g.budgetShort||g.demandShort;
  const status=g.loss?'손실 위험':g.budgetShort&&g.demandShort?'예산·검색량 부족':g.budgetShort?'예산 부족':g.demandShort?'검색량 부족':g.status==='unknown'?'검색량 미확인':'계산상 가능';
  const maxOrders=Math.min(g.budgetOrders,g.demandOrders??g.budgetOrders);
  return <div className="mp-goal-compact"><span className={risky?'mp-compact-risk':g.status==='unknown'?'mp-compact-unknown':'mp-compact-good'}>{status}</span><dl><div><dt>판매 상한 · 계산상</dt><dd>{n(maxOrders)} / {n(quantity)}개</dd></div>{g.budgetShort&&<div><dt>부족한 광고비</dt><dd className="mp-compact-risk">{money(g.extraBudget)}</dd></div>}{g.loss&&<div><dt>목표 광고비 손실</dt><dd className="mp-compact-risk">{money(diagnostic.goalAdLoss)}</dd></div>}{g.demandShort&&<div><dt>부족한 클릭</dt><dd className="mp-compact-risk">{n(diagnostic.missingClicks??0)}회</dd></div>}</dl><details><summary>계산 자세히</summary><KeywordGoalCheck cpc={cpc} perOrder={perOrder} budget={budget} quantity={quantity} months={months} cvr={cvr} volume={volume} device={device} budgetContext={budgetContext}/></details></div>;
 }
 return <section className={`mp-goal-check ${g.status==='conditional'?'is-conditional':g.status==='unknown'?'is-short':'is-critical'}`} role={g.loss||g.budgetShort||g.demandShort?'alert':undefined} aria-label="판매 목표 점검"><b>{g.loss||g.budgetShort||g.demandShort?'⚠ 목표 달성 위험 · ':''}{title}</b><p>{months}개월 · {n(quantity)}개 목표 · 구매 비율 {n(cvr)}% 가정</p>
 <ul className="mp-goal-causes">
 {g.budgetShort&&<li><strong>광고비 부족: {money(g.extraBudget)}</strong><p>쓸 수 있는 홍보비 {money(budget)}로는 최대 {n(g.budgetOrders)}개 판매가 가능해요. 목표에는 {money(g.neededBudget)}이 필요해요.</p>{budgetContext&&<p>{budgetContext.basis==='sales'?'총매출':'전체 금액'} {money(budgetContext.available)} − 상품·판매 비용 {money(budgetContext.reserved)} = {budgetContext.basis==='sales'?'홍보 전 남는 이익':'남는 자금'} {money(budgetContext.cashRoom)}. {budgetContext.basis==='sales'?'전량 판매 후 이익을 기준으로 홍보비 한도를 계산해요.':'홍보비는 남는 자금과 이익 한도 중 작은 금액으로 제한돼요.'}</p>}{diagnostic.inventoryCashShortfall!==null&&diagnostic.inventoryCashShortfall>0&&<p>광고를 시작하기 전부터 상품·판매 비용이 {money(diagnostic.inventoryCashShortfall)} 부족해요.</p>}</li>}
 {g.loss&&<li><strong>{diagnostic.unitAdLoss>0?`판매할수록 손해: 건당 ${money(diagnostic.unitAdLoss)}`:`목표 광고비가 이익 한도를 ${money(diagnostic.goalAdLoss)} 초과해요`}</strong><p>{diagnostic.unitAdLoss>0?`예상 구매 한 건의 광고비 ${money(diagnostic.estimatedCpa)}가 한도 ${money(perOrder)}를 넘어요.`:`필요한 클릭 수를 정수로 올리면 광고비가 ${money(g.neededBudget)}이 되어 총 이익 한도를 넘어요.`} 예산만 늘려서는 해결되지 않아요. 가격·비용·클릭 비용·구매 비율을 조정해야 해요.</p></li>}
 {g.demandShort&&<li><strong>검색량 부족: 클릭 {n(diagnostic.missingClicks??0)}회 부족</strong><p>{months}개월 검색량 상한 {n(diagnostic.totalSearches??0)}회보다 필요한 클릭 {n(g.neededClicks)}회가 많아요. 검색어·채널을 추가하거나 기간을 늘리세요.</p></li>}
 </ul><dl><div><dt>{budgetContext?.basis==='sales'?'총매출 기준 홍보비 한도':'현재 예산'}</dt><dd>{money(budget)}</dd></div><div><dt>예산으로 가능한 판매 수 · 계산상</dt><dd>최대 {n(g.budgetOrders)}개</dd></div><div><dt>목표에 필요한 클릭 / 광고비</dt><dd>{n(g.neededClicks)}회 / {money(g.neededBudget)}</dd></div><div><dt>월 검색량 · {device}</dt><dd>{volume?`${formatRange(volume)}회`:'자료 없음'}</dd></div></dl>
 {g.requiredShare!==null&&<p>목표를 채우려면 기간 내 검색의 <b>{requiredPercent(g.requiredShare)}%</b>가 내 광고 클릭으로 이어져야 해요.</p>}
 <p className="mp-goal-solution">{g.loss?'예산을 늘리기 전에 더 싼 검색어를 찾거나, 가격·비용·구매 비율을 개선하세요.':<>{g.demandShort&&'이 검색어만으로는 부족해요. 관련 검색어·판매 채널을 더하거나 기간을 늘리세요. '}{g.budgetShort&&<>같은 구매 비율이면 홍보비 {money(g.extraBudget)} 더 필요해요. 전체 자금도 다시 확인하세요. 더 싼 검색어를 고르는 방법도 있어요. </>}{!g.budgetShort&&!g.demandShort&&(volume?'적은 예산으로 실제 클릭과 구매 비율부터 확인하세요. 클릭 확보가 어렵다면 검색어·채널을 더하세요.':'예산 계산은 가능하지만, 검색량을 확인해야 목표 기간을 점검할 수 있어요.')}</>}</p>
 {g.requiredCvr!==null&&g.budgetShort&&<p>예산을 유지하려면 구매 비율 {requiredPercent(g.requiredCvr)}% 이상이 필요해요.{g.requiredCvr>100&&' 100%를 넘어 현재 예산으로는 불가능해요.'}</p>}
 <small>검색량이 매달 같고, 검색 1회당 최대 클릭 1회를 가정한 상한이에요. 노출·클릭·판매를 보장하지 않아요. 검색어별 결과는 따로 계산하며, 같은 예산을 여러 번 쓸 수는 없어요.</small></section>;
}
