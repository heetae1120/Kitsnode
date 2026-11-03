export type MarketingPlanInput = {
  price: number; cost: number; quantity: number; available: number;
  feePercent: number; logistics: number; packaging: number; returns: number;
  certification: number; fixed: number;
  marketingBudget?: number; purchaseBudget?: number;
};

export function marketingPlan(p: MarketingPlanInput) {
  if (Object.values(p).some(v => !Number.isFinite(v) || v < 0) || p.price <= 0 || !Number.isSafeInteger(p.quantity) || p.quantity < 1 || p.feePercent > 100) {
    throw new Error('판매가·수량은 0보다 크게, 비용은 0 이상으로 입력해 주세요. 수수료는 100% 이하여야 합니다.');
  }
  const fee = p.price * p.feePercent / 100;
  const variable = p.cost + fee + p.logistics + p.packaging + p.returns;
  const margin = p.price - variable;
  const fixed = p.certification + p.fixed;
  const reserved = variable * p.quantity + fixed;
  const cashRoom = p.available - reserved;
  const profitRoom = margin * p.quantity - fixed;
  const marketing = Math.max(0, Math.floor(Math.min(cashRoom, profitRoom, p.marketingBudget ?? Infinity)));
  const perOrder = Math.max(0, margin - fixed / p.quantity);
  const breakEvenUnits = margin > 0 ? Math.ceil((fixed + marketing) / margin) : null;
  const result = {fee, variable, margin, fixed, reserved, cashRoom, profitRoom, marketing, perOrder,
    breakEvenUnits, breakEvenRoas: perOrder > 0 ? p.price / perOrder * 100 : null,
    sales: p.price * p.quantity, profit: profitRoom - marketing};
  if (Object.values(result).some(v => typeof v === 'number' && !Number.isFinite(v))) throw new Error('입력 금액이 너무 큽니다.');
  return result;
}

export function resolvePlanBudget(mode:'split'|'total',purchase:string,marketing:string,total:string){
 const valid=(value:string)=>value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
 if(mode==='total'){
  if(!valid(total))throw Error('총 가용비용을 0 이상으로 입력해 주세요.');
  return {available:Number(total)};
 }
 if(!valid(purchase)||!valid(marketing))throw Error('구매 예정 비용과 마케팅 예정 비용을 모두 입력해 주세요. 모르겠다면 총 가용비용 입력을 선택하세요.');
 const available=Number(purchase)+Number(marketing);
 if(!Number.isFinite(available))throw Error('입력 금액이 너무 큽니다.');
 return {available,purchaseBudget:Number(purchase),marketingBudget:Number(marketing)};
}
