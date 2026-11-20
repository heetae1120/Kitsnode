export type PlannerCosts = {
  price:number; cost:number; quantity:number; available:number;
  feePercent:number; logistics:number; packaging:number;
  returnRate:number; returnHandling:number;
  /** One-time costs allocated across this product's planned quantity. */
  fixed?:number;
};
/** Return rate allocates handling losses across planned sales, not lost revenue. */
export function plannerLiveCosts(p:PlannerCosts){
  const fixed=p.fixed??0;
  if(Object.values({...p,fixed}).some(value=>!Number.isFinite(value)||value<0)||p.feePercent>100||p.returnRate>100||!Number.isSafeInteger(p.quantity)||p.quantity<1) throw Error('금액과 수량을 확인해 주세요. 수수료와 반품률은 0~100%로 입력해 주세요.');
  const returns=p.returnRate/100*p.returnHandling;
  const fee=p.price*p.feePercent/100;
  const variable=p.cost+fee+p.logistics+p.packaging+returns;
  const unitCost=variable+fixed/p.quantity;
  const profit=p.price-unitCost;
  const stockCost=p.cost*p.quantity;
  const remaining=p.available-variable*p.quantity-fixed;
  const marginTotal=(p.price-variable)*p.quantity-fixed;
  if([returns,fee,unitCost,profit,stockCost,remaining,marginTotal].some(value=>!Number.isFinite(value)))throw Error('입력 금액이 너무 큽니다.');
  return {returns,fee,variable,fixed,unitCost,profit,stockCost,remaining,marginTotal};
}
