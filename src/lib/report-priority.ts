import type {keywordGoalDiagnostics} from './keyword-goal';
type Input={margin:number;perOrder:number;exampleCosts:boolean;diagnostic:ReturnType<typeof keywordGoalDiagnostics>};
export function reportPriority({margin,perOrder,exampleCosts,diagnostic}:Input){
 if(margin<=0||perOrder<=0)return {title:'판매 가격과 원가부터 조정하세요',reason:'광고비를 쓰기 전부터 남는 이익이 없어요.',action:'한 개당 판매가가 상품·판매 비용보다 높아지도록 가격과 원가를 다시 계산하세요.'};
 if(diagnostic?.goal.loss)return {title:'한 건당 광고비부터 낮추세요',reason:'현재 광고 조건으로 목표 수량을 팔면 이익 한도를 넘어요.',action:'구매 1건당 예상 광고비가 한 건당 이익 한도 안에 들어오는 검색어를 먼저 비교하세요.'};
 if(diagnostic?.goal.demandShort)return {title:'검색량을 확보할 검색어부터 찾으세요',reason:'현재 검색어 하나의 검색량으로는 목표 수량을 채우기 어려워요.',action:'함께 볼 검색어 중 내 상품과 구매 목적이 맞는 검색어 하나를 추가로 검토하세요.'};
 if(diagnostic?.goal.budgetShort)return {title:'목표 판매수량부터 조정하세요',reason:'현재 마케팅비용 한도로는 목표 수량에 필요한 광고비가 부족해요.',action:'계산상 판매 가능 수량을 기준으로 첫 판매 목표를 줄여 다시 확인하세요.'};
 if(exampleCosts)return {title:'참고값을 실제 판매 비용으로 바꾸세요',reason:'수수료나 배송비 등에 참고값이 포함되어 있어요.',action:'판매처에서 확인한 실제 비용을 입력하고 남는 이익을 다시 확인하세요.'};
 if(!diagnostic||diagnostic.goal.status==='unknown')return {title:'대표 검색어의 검색량부터 확인하세요',reason:'판매 가능성을 판단할 검색량이나 구매 비율 자료가 부족해요.',action:'대표 검색어 조회를 완료하고 실제 구매 비율을 입력해 목표를 다시 점검하세요.'};
 return {title:'작은 예산으로 구매 1건의 실제 광고비를 확인하세요',reason:'입력한 조건에서는 목표 계산이 가능하지만 실제 성과 확인이 필요해요.',action:'첫 테스트에서 쓴 광고비를 구매 건수로 나눠 한 건당 이익 한도와 비교하세요.'};
}
