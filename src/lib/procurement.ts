export type ProcurementInput = {
  unitCost:number; foreignCurrency:boolean; exchangeRate:number; moq:number;
  batchLogistics:number; deliveryPayer:'customer'|'seller'; sellerDelivery:number; unitOther:number;
};
export function procurementCosts(p:ProcurementInput){
  const values=[p.unitCost,p.batchLogistics,p.deliveryPayer==='seller'?p.sellerDelivery:0,p.unitOther];
  if(values.some(n=>!Number.isFinite(n)||n<0||n>1e9))throw new Error('매입·물류·배송 비용은 0~10억 원 범위의 숫자여야 합니다.');
  if(!Number.isSafeInteger(p.moq)||p.moq<1||p.moq>1e9)throw new Error('MOQ는 1~10억 개의 정수로 입력하세요.');
  if(p.foreignCurrency&&(!Number.isFinite(p.exchangeRate)||p.exchangeRate<=0||p.exchangeRate>1e9))throw new Error('매입 당시 환율을 0보다 큰 값으로 입력하세요.');
  const unitCost=p.unitCost*(p.foreignCurrency?p.exchangeRate:1);
  const unitLogistics=p.batchLogistics/p.moq;
  if(unitCost>1e9||unitLogistics+p.unitOther>1e9)throw new Error('환율·물류비 반영 후 개당 비용은 10억 원 이하여야 합니다.');
  return {unitCost,unitLogistics,shipping:p.deliveryPayer==='seller'?p.sellerDelivery:0,other:p.unitOther+unitLogistics,batchCash:unitCost*p.moq+p.batchLogistics};
}
