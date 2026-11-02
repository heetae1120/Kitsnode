export type AgencyWeekInput={price:number;cost:number;units:number;adSpend:number;agencyFee:number;feePercent:number;shipping:number;other:number;adUnits:number|null};
export function analyzeAgencyWeek(p:AgencyWeekInput){
  const values=[p.price,p.cost,p.units,p.adSpend,p.agencyFee,p.feePercent,p.shipping,p.other];
  if(values.some(n=>!Number.isFinite(n)||n<0||n>1e9)||p.price<=0||p.feePercent>100||!Number.isSafeInteger(p.units))throw new Error('판가는 0보다 크게, 비용은 0 이상으로 입력하세요. 판매 수량은 정수, 수수료율은 0~100%입니다.');
  if(p.adUnits!==null&&(!Number.isSafeInteger(p.adUnits)||p.adUnits<0||p.adUnits>p.units))throw new Error('광고 구매완료 수량은 전체 판매 수량 이하의 정수로 입력하세요.');
  const margin=p.price-p.cost-p.price*p.feePercent/100-p.shipping-p.other;
  const spend=p.adSpend+p.agencyFee;
  const revenue=p.price*p.units;
  const weekContribution=margin*p.units-spend;
  const adContribution=p.adUnits===null?null:margin*p.adUnits-spend;
  return {margin,revenue,spend,weekContribution,adContribution,adRevenue:p.adUnits===null?null:p.price*p.adUnits,roas:p.adUnits===null||p.adSpend===0?null:p.price*p.adUnits/p.adSpend*100,breakEvenUnits:margin>0?Math.ceil(spend/margin):null};
}
