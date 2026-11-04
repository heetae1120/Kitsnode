import {keywordGoal} from '@/lib/keyword-goal';
import {formatRange,type CountRange} from '@/lib/naver-keywords';
const n=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:2});
const requiredPercent=(v:number)=>n(Math.ceil(v*100)/100);
const money=(v:number)=>`${Math.ceil(v).toLocaleString('ko-KR')}원`;
export function KeywordGoalCheck({cpc,perOrder,budget,quantity,months,cvr,volume,device}:{cpc:number;perOrder:number;budget:number;quantity:number;months:number;cvr:number;volume:CountRange|null;device:string}){
 const g=keywordGoal({cpc,perOrder,budget,quantity,months,cvr,monthlySearches:volume?.max??null});
 if(!g)return <p className="mp-keyword-over">구매 비율을 0% 초과~100%로 입력하면 목표를 계산해요.</p>;
 const title={loss:'한 개 팔 때 손해예요',both:'예산과 검색량 모두 부족해요',budget:'이 예산으로는 목표 수량이 부족해요',demand:'이 검색어 하나로는 수량이 부족해요',unknown:'검색량 확인이 더 필요해요',conditional:'계산 조건은 맞아요 · 실제 클릭 확인 필요'}[g.status];
 return <section className={`mp-goal-check ${g.status==='conditional'?'is-conditional':'is-short'}`} aria-label="판매 목표 점검"><b>{title}</b><p>{months}개월 · {n(quantity)}개 목표 · 구매 비율 {n(cvr)}% 가정</p><dl><div><dt>현재 예산</dt><dd>{money(budget)}</dd></div><div><dt>예산으로 가능한 판매 수 · 계산상</dt><dd>최대 {n(g.budgetOrders)}개</dd></div><div><dt>목표에 필요한 클릭 / 광고비</dt><dd>{n(g.neededClicks)}회 / {money(g.neededBudget)}</dd></div><div><dt>월 검색량 · {device}</dt><dd>{volume?`${formatRange(volume)}회`:'자료 없음'}</dd></div></dl>
 {g.requiredShare!==null&&<p>목표를 채우려면 기간 내 검색의 <b>{requiredPercent(g.requiredShare)}%</b>가 내 광고 클릭으로 이어져야 해요.</p>}
 <p className="mp-goal-solution">{g.loss?'예산을 늘리기 전에 더 싼 검색어를 찾거나, 가격·비용·구매 비율을 개선하세요.':<>{g.demandShort&&'이 검색어만으로는 부족해요. 관련 검색어·판매 채널을 더하거나 기간을 늘리세요. '}{g.budgetShort&&<>같은 구매 비율이면 홍보비 {money(g.extraBudget)}가 더 필요해요. 전체 자금도 다시 확인하세요. 더 싼 검색어를 고르는 방법도 있어요. </>}{!g.budgetShort&&!g.demandShort&&(volume?'적은 예산으로 실제 클릭과 구매 비율부터 확인하세요. 클릭 확보가 어렵다면 검색어·채널을 더하세요.':'예산 계산은 가능하지만, 검색량을 확인해야 목표 기간을 점검할 수 있어요.')}</>}</p>
 {g.requiredCvr!==null&&g.budgetShort&&<p>예산을 유지하려면 구매 비율 {requiredPercent(g.requiredCvr)}% 이상이 필요해요.{g.requiredCvr>100&&' 100%를 넘어 현재 예산으로는 불가능해요.'}</p>}
 <small>검색량이 매달 같고, 검색 1회당 최대 클릭 1회를 가정한 상한이에요. 노출·클릭·판매를 보장하지 않아요. 검색어별 결과는 따로 계산하며, 같은 예산을 여러 번 쓸 수는 없어요.</small></section>;
}
