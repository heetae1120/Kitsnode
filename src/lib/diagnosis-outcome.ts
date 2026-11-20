import type {ReportEvidence} from './diagnosis-analysis';

type Input={quantity:number;months:number;sales:number;costs:number;profit:number;marketing:number;analysis?:ReportEvidence};
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
/** Direction under the selected Naver CPC/CVR scenario, never a sales forecast. */
export function diagnosisOutcome(r:Input){
 const k=r.analysis?.keyword,d=k?.diagnostic;
 const known=!!k&&!!d&&Number.isFinite(k.cpc)&&k.cpc>0&&Number.isFinite(k.cvr)&&k.cvr>0&&k.cvr<=100&&Number.isSafeInteger(r.quantity)&&r.quantity>0&&Number.isSafeInteger(d.goal.neededBudget)&&d.goal.neededBudget>=0&&Number.isSafeInteger(d.goal.neededClicks)&&d.goal.neededClicks>0&&[r.sales,r.costs,r.profit].every(Number.isFinite);
 const adBudget=known?d!.goal.neededBudget:null;
 const afterProfit=adBudget===null?null:r.profit-adBudget;
 const status=afterProfit===null?'pending':afterProfit>0?'positive':'negative';
 const headline=status==='positive'?'현재 네이버 기준으로\n플러스에 가까워요.':status==='negative'?'현재 네이버 기준으로\n마이너스에 가까워요.':'네이버 기준 손익은\n아직 판단을 보류해요.';
 const summary=(known&&k!.conversionBasis==='break-even'?'구매 비율은 본전 기준으로 자동 입력한 가정값이에요. ':'')+(status==='positive'?'입력한 판매 조건과 선택한 광고비 가정에서는 비용을 뺀 금액이 남는 쪽이에요. 실제로도 남는지는 적은 금액으로 먼저 확인해보세요.':status==='negative'?(afterProfit===0?'계산상 본전에 걸쳐 있어요. 클릭 비용이나 반품 비용이 조금만 늘어도 마이너스로 바뀔 수 있어요.':'현재 가정에서는 판매 비용과 광고비가 판매금액보다 큰 쪽이에요. 가격·원가·광고 조건을 바꿔 다시 비교해보세요.'):'클릭 비용이나 구매 비율 자료가 아직 충분하지 않아요. 광고 전 이익만으로 네이버 광고 후 손익을 판단하지 않아요.');
 const conditions=[`${r.quantity.toLocaleString('ko-KR')}개 전량 판매${r.months>0?` · ${r.months}개월`:''} 가정`,...(known?[`‘${k!.name}’ · CPC ${money(k!.cpc)} · 구매 비율 ${k!.cvr.toLocaleString('ko-KR')}% 가정`,`CPC 근거: ${k!.source}`]:['CPC·구매 비율 확인 후 광고 후 손익 계산']), '입력 조건과 공개 자료에 따른 참고 계산이며, 실제 판매 결과와 달라질 수 있어요.'];
 if(known&&!k!.volume)conditions.push('검색량 미확인: 목표 수량을 팔 수 있다는 판단은 보류해요.');
 else if(known&&d!.goal.demandShort)conditions.push('검색량 대비 목표가 커요. 손익 방향과 판매 가능 수량은 따로 확인해야 해요.');
 if(known&&k!.conversionBasis==='break-even')conditions.push('구매 비율은 본전 기준 자동 입력값이며 실제 구매 실적이 아니에요.');
 const scenarios=known?[{label:'클릭 비용 −20%',factor:.8},{label:'현재 가정',factor:1},{label:'클릭 비용 +20%',factor:1.2}].map(({label,factor})=>({label,profit:r.profit-(factor===1?adBudget!:Math.ceil(d!.goal.neededClicks*k!.cpc*factor))})):[];
 const actions=status==='positive'?['소액으로 실제 구매 비율부터 확인해보세요.','CPC와 구매 비율을 같은 기간으로 기록하고, 광고 후 남는 금액을 비교해보세요.','클릭 비용 상승·반품 증가에도 여유가 있는지 아래 시나리오를 확인해보세요.']:status==='negative'?['광고비를 늘리기 전에 손익이 바뀌는 조건을 찾아보세요.','가격·상품 원가·배송비와, 한 건을 팔 때 드는 광고비를 함께 조정해보세요.','구매 비율이 아직 가정값이라면 실제 자료를 확보한 뒤 재진단해보세요.']:['대표 검색어의 CPC와 구매 비율을 확인해주세요.','빠진 비용과 제작비 배분을 확인한 뒤 같은 조건으로 비교해보세요.','자료가 없는 항목은 임의의 성과로 채우지 않아요.'];
 return {status,headline,summary,adBudget,afterProfit,perUnit:afterProfit===null?null:afterProfit/r.quantity,conditions,scenarios,actions};
}
