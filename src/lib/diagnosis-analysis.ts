import {diagnosisOutcome} from './diagnosis-outcome';
import type {CountRange} from './naver-keywords';
import type {keywordGoalDiagnostics} from './keyword-goal';
import type {ShoppingAdSnapshot} from './shopping-ad-snapshot';
export type ReportEvidence={
 keyword?:{name:string;cpc:number;cvr:number;conversionBasis?:'user'|'break-even';volume:CountRange|null;device:string;source:string;diagnostic:ReturnType<typeof keywordGoalDiagnostics>};
 ads?:{status:'loading'|'ready'|'unavailable';keyword:string;snapshot?:ShoppingAdSnapshot;error?:string};
};
type Numbers={sales:number;costs:number;price?:number;quantity:number;months:number;profit:number;margin:number;marketing:number;priority:string;action:string;analysis?:ReportEvidence};
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function diagnosisAnalysis(r:Numbers){
 const k=r.analysis?.keyword,d=k?.diagnostic,a=r.analysis?.ads;
 const outcome=diagnosisOutcome(r),verdict=outcome.headline.replace('\n',' ');
 const findings=[`고정비를 수량에 배분한 광고 전 개당 이익은 ${money(r.profit/r.quantity)}이며, 계획 수량 전량 판매 시 광고 전 이익은 ${money(r.profit)}입니다.`];
 if(k&&d){findings.push(`‘${k.name}’의 클릭 비용 ${money(k.cpc)}, 구매 비율 ${k.cvr.toLocaleString('ko-KR')}% 가정에서 구매 1건당 광고비는 ${money(d.estimatedCpa)}입니다.`);findings.push(d.unitAdLoss>0?`광고비가 개당 이익을 ${money(d.unitAdLoss)} 초과합니다. 가격·원가·구매 비율 조건을 바꾸면 손익이 달라질 수 있습니다.`:`구매 1건당 광고비를 뺀 기여 이익은 ${money(r.profit/r.quantity-d.estimatedCpa)}입니다. 실제 클릭 비용과 구매 비율 검증이 필요합니다.`);findings.push(`목표 ${r.quantity.toLocaleString('ko-KR')}개에 필요한 광고비는 ${money(d.goal.neededBudget)}이며, 광고 후 전체 손익은 ${money(r.profit-d.goal.neededBudget)}로 계산됩니다. 실제 결과와 달라질 수 있습니다. 정수 클릭 수를 반영한 계산입니다.`);if(d.goal.demandShort)findings.push(`기간 내 필요한 클릭이 공개 검색량보다 ${(d.missingClicks??0).toLocaleString('ko-KR')}회 많습니다. 검색어를 분산하거나 판매 기간·수량을 조정하세요.`);}
 else findings.push('클릭 비용·구매 비율 또는 검색량 자료가 충분하지 않아 광고 후 손익과 목표 달성 여부를 확정할 수 없습니다.');
 const ads=a?.status==='ready'?a.snapshot?.items??[]:[];
 const reviews=ads.filter(v=>v.reviewCount),ratings=ads.filter(v=>v.rating!=null),periods=ads.filter(v=>v.dailySales!=null||v.weeklySales!=null);
 const market=ads.length?[`조회 시점에 광고 표시가 확인된 상품 ${ads.length}개를 비교했습니다. 노출 순서는 고정 순위가 아닙니다.`,`리뷰 ${reviews.length}/${ads.length}개, 별점 ${ratings.length}/${ads.length}개, 기간별 판매 지표 ${periods.length}/${ads.length}개가 공개되어 있습니다.`,reviews.length?'경쟁 상품의 리뷰 축적과 구매 근거를 확인하고, 상세페이지의 사용 장면·차별점·신뢰 정보를 점검하세요.':'공개 리뷰만으로 경쟁 우위를 판단할 수 없습니다. 상품별 구매 근거를 추가로 확인하세요.']:['광고 상품 자료를 확보하지 못했습니다. 경쟁 상품의 판매량이나 성과를 임의로 추정하지 않습니다.'];
 return {verdict,findings,market,actions:outcome.actions,outcome};
}
