export function breakEvenConversion(cpc:number,perOrder:number){
 if(!Number.isFinite(cpc)||!Number.isFinite(perOrder)||cpc<=0||perOrder<=0)return null;
 return cpc/perOrder*100;
}

export type GoalBudgetContext = {available:number;reserved:number;cashRoom:number;profitRoom:number};

/** Separate insufficient cash from unprofitable advertising; extra money does not fix a loss. */
export function keywordGoalDiagnostics(input:Parameters<typeof keywordGoal>[0],context?:GoalBudgetContext){
 const goal=keywordGoal(input);
 if(!goal)return null;
 const estimatedCpa=input.cpc/(input.cvr/100);
 const totalSearches=input.monthlySearches===null?null:input.monthlySearches*input.months;
 const missingClicks=totalSearches===null?null:Math.max(0,goal.neededClicks-totalSearches);
 const validContext=context&&Object.values(context).every(Number.isFinite)?context:null;
 return {goal,estimatedCpa,unitAdLoss:Math.max(0,estimatedCpa-input.perOrder),
  goalAdLoss:Math.max(0,goal.neededBudget-input.quantity*input.perOrder),totalSearches,missingClicks,
  inventoryCashShortfall:validContext?Math.max(0,-validContext.cashRoom):null,
  extraWorkingCapital:validContext?Math.max(0,goal.neededBudget-validContext.cashRoom):null};
}

/** Upper bounds, not sales forecasts: at most one paid click per search. */
export function keywordGoal(input:{cpc:number;perOrder:number;budget:number;quantity:number;months:number;cvr:number;monthlySearches:number|null}){
 const {cpc,perOrder,budget,quantity,months,cvr,monthlySearches}=input;
 if(![cpc,perOrder,budget,quantity,months,cvr].every(Number.isFinite)||cpc<=0||perOrder<0||budget<0||!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(months)||months<1||cvr<=0||cvr>100||monthlySearches!==null&&(!Number.isSafeInteger(monthlySearches)||monthlySearches<0))return null;
 const rate=cvr/100;
 const neededClicks=Math.ceil(quantity/rate);
 const neededBudget=Math.ceil(neededClicks*cpc);
 const budgetClicks=Math.floor(budget/cpc);
 const searchClicks=monthlySearches===null?null:monthlySearches*months;
 const budgetOrders=Math.floor(budgetClicks*rate);
 const demandOrders=searchClicks===null?null:Math.floor(searchClicks*rate);
 if(![neededClicks,neededBudget,budgetClicks,budgetOrders,...(searchClicks===null?[]:[searchClicks,demandOrders!])].every(Number.isSafeInteger))return null;
 const budgetShort=budgetOrders<quantity;
 const demandShort=demandOrders!==null&&demandOrders<quantity;
 const loss=cpc/rate>perOrder+1e-8||neededBudget>Math.floor(quantity*perOrder);
 const result={neededClicks,neededBudget,budgetOrders,demandOrders,budgetShort,demandShort,loss,
  extraBudget:Math.max(0,neededBudget-budget),
  requiredShare:searchClicks===null||searchClicks===0?null:neededClicks/searchClicks*100,
  requiredCvr:budgetClicks>0?quantity/budgetClicks*100:null,
  status:loss?'loss':budgetShort&&demandShort?'both':budgetShort?'budget':demandShort?'demand':searchClicks===null?'unknown':'conditional'} as const;
 return Object.values(result).some(v=>typeof v==='number'&&!Number.isFinite(v))?null:result;
}
