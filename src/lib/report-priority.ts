import type {keywordGoalDiagnostics} from './keyword-goal';
type Input={margin:number;perOrder:number;exampleCosts:boolean;cost?:number;extraCost?:number;diagnostic:ReturnType<typeof keywordGoalDiagnostics>};
export function reportPriority({margin,perOrder,exampleCosts,cost=0,extraCost=0,diagnostic}:Input){
 if(margin<=0||perOrder<=0)return cost>=extraCost?{title:'원가를 낮추세요',reason:'상품을 팔아도 남는 금액이 없어요.',action:'상품 구매 단가를 낮출 수 있는지 확인하세요.'}:{title:'배송비·포장비를 줄이세요',reason:'부가 비용을 빼면 남는 금액이 없어요.',action:'배송 계약이나 포장 방식을 바꿔 비용을 줄여보세요.'};
 if(diagnostic?.goal.loss)return {title:'광고비가 더 적게 드는 검색어를 고르세요',reason:'지금 조건으로는 광고비를 빼면 손해예요.',action:'아래 검색어 중 한 건을 팔 때 광고비가 더 적게 드는 것을 확인하세요.'};
 if(diagnostic?.goal.demandShort)return {title:'찾는 사람이 더 많은 검색어를 고르세요',reason:'지금 검색어로는 목표만큼 팔기 어려워요.',action:'함께 볼 검색어에서 내 상품과 맞는 검색어 하나를 더 찾아보세요.'};
 if(diagnostic?.goal.budgetShort)return {title:'처음 팔 수량을 줄이세요',reason:'목표 수량을 팔기에는 광고비가 부족해요.',action:'화면에 나온 판매 가능 수량부터 시작해보세요.'};
 if(exampleCosts)return cost>extraCost?{title:'원가를 낮추세요',reason:'입력한 원가가 배송비·포장비보다 커요.',action:'상품 구매 단가를 낮추면 한 개 팔 때 남는 금액이 늘어요.'}:{title:'배송비·포장비를 줄이세요',reason:'배송비와 포장비도 이익을 줄여요.',action:'배송 계약이나 포장 방식을 바꿔 비용을 줄여보세요.'};
 if(!diagnostic||diagnostic.goal.status==='unknown')return {title:'이 상품을 찾는 사람이 얼마나 되는지 확인하세요',reason:'아직 검색량이나 구매 비율을 확인하지 못했어요.',action:'대표 검색어를 다시 조회해보세요.'};
 return {title:'적은 광고비로 먼저 팔아보세요',reason:'계산상으로는 이익이 남아요.',action:'광고비를 조금만 써보고 실제로 얼마가 남는지 확인하세요.'};
}
