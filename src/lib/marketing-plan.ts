export type MarketingPlanInput = {
  price: number; cost: number; quantity: number; available: number;
  feePercent: number; logistics: number; packaging: number; returns: number;
  certification: number; fixed: number;
  /** Optional original return-cost inputs; both must be supplied together. */
  returnRate?: number; returnHandling?: number;
  marketingBudget?: number; purchaseBudget?: number;
};

/** Post-sale scenario: fund promotion from total sales less all selling costs. */
export function salesFundedMarketingPlan(input:MarketingPlanInput){
  return marketingPlan({...input,available:input.price*input.quantity});
}

/** Inventory only: shipping, fees and promotion are not part of this purchase ceiling. */
export function budgetPurchaseCapacity(available:number,cost:number):number|null{
  if(!Number.isFinite(available)||available<0||!Number.isFinite(cost)||cost<=0)return null;
  const count=Math.floor(available/cost);
  return Number.isSafeInteger(count)?count:null;
}

/** Exact whole-unit threshold from original decimal inputs, not rounded intermediates. */
export function marketingBreakEvenUnits(p: MarketingPlanInput, marketing: number): number | null {
  const parts = (value: number) => {
    if (!Number.isFinite(value) || value < 0) throw new Error('입력 금액이 올바르지 않습니다.');
    const [coefficient, exponent = '0'] = value.toString().toLowerCase().split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    let units = BigInt(whole + fraction), scale = fraction.length - Number(exponent);
    if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
    return {units, scale};
  };
  const percentOf = (amount: number, percent: number) => {
    const a = parts(amount), b = parts(percent);
    return {units: a.units * b.units, scale: a.scale + b.scale + 2};
  };
  const hasReturnSource = p.returnRate !== undefined || p.returnHandling !== undefined;
  if (hasReturnSource && (p.returnRate === undefined || p.returnHandling === undefined || !Number.isFinite(p.returnRate) || p.returnRate < 0 || p.returnRate > 100 || !Number.isFinite(p.returnHandling) || p.returnHandling < 0)) throw new Error('반품률과 반품 처리비를 함께 확인해 주세요.');
  const price = parts(p.price), fee = percentOf(p.price, p.feePercent);
  // Legacy direct per-unit returns remain supported. The UI provides the original factors.
  const returns = hasReturnSource ? percentOf(p.returnHandling!, p.returnRate!) : parts(p.returns);
  const costs = [parts(p.cost), parts(p.logistics), parts(p.packaging), returns];
  const fixed = [p.certification, p.fixed, marketing].map(parts);
  const scale = Math.max(price.scale, fee.scale, ...costs.map(v => v.scale), ...fixed.map(v => v.scale));
  const scaled = (value: {units: bigint; scale: number}) => value.units * 10n ** BigInt(scale - value.scale);
  const margin = scaled(price) - scaled(fee) - costs.reduce((sum, v) => sum + scaled(v), 0n);
  if (margin <= 0n) return null;
  const required = fixed.reduce((sum, v) => sum + scaled(v), 0n);
  const units = (required + margin - 1n) / margin;
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('입력 금액이 너무 큽니다.');
  return Number(units);
}

export function marketingPlan(p: MarketingPlanInput) {
  if (Object.values(p).some(v => !Number.isFinite(v) || v < 0) || p.price <= 0 || !Number.isSafeInteger(p.quantity) || p.quantity < 1 || p.feePercent > 100) {
    throw new Error('판매가·수량은 0보다 크게, 비용은 0 이상으로 입력해 주세요. 수수료는 100% 이하여야 합니다.');
  }
  const fee = p.price * p.feePercent / 100;
  const returns = p.returnRate !== undefined && p.returnHandling !== undefined ? p.returnRate / 100 * p.returnHandling : p.returns;
  const variable = p.cost + fee + p.logistics + p.packaging + returns;
  const margin = p.price - variable;
  const fixed = p.certification + p.fixed;
  const reserved = variable * p.quantity + fixed;
  const cashRoom = p.available - reserved;
  const profitRoom = margin * p.quantity - fixed;
  const marketing = Math.max(0, Math.floor(Math.min(cashRoom, profitRoom, p.marketingBudget ?? Infinity)));
  const perOrder = Math.max(0, margin - fixed / p.quantity);
  const breakEvenUnits = marketingBreakEvenUnits(p, marketing);
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
