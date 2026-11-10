import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetPurchaseCapacity,salesFundedMarketingPlan,marketingPlan} from '../src/lib/marketing-plan';
import {marketingTestBudget} from '../src/lib/marketing-test-budget';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';

test('purchase capacity uses available inventory cash, floors quantities and rejects undefined ceilings',()=>{
 assert.equal(budgetPurchaseCapacity(10000000,20000),500);
 assert.equal(budgetPurchaseCapacity(99999,20000),4);
 assert.equal(budgetPurchaseCapacity(0,20000),0);
 assert.equal(budgetPurchaseCapacity(19999,20000),0);
 for(const [available,cost] of [[100,0],[-1,10],[Infinity,10],[10,NaN],[Number.MAX_VALUE,0.001]])assert.equal(budgetPurchaseCapacity(available,cost),null);
});
const input={price:100000,cost:20000,quantity:400,available:10000000,feePercent:6,logistics:3000,packaging:1000,returns:250,certification:0,fixed:0};
test('post-sale report derives promotion and suggested test budgets from sales rather than starting cash',()=>{
 const cash=marketingPlan(input);const sales=salesFundedMarketingPlan(input);
 assert.equal(cash.cashRoom,-2100000);
 assert.equal(sales.sales,40000000);assert.equal(sales.reserved,12100000);
 assert.equal(sales.cashRoom,27900000);assert.equal(sales.profitRoom,27900000);assert.equal(sales.marketing,27900000);
 assert.equal(marketingTestBudget({...input,available:sales.sales})?.amount,2790000);
 assert.equal(salesFundedMarketingPlan({...input,available:0}).marketing,sales.marketing);
 assert.equal(input.available,10000000);
 assert.equal(salesFundedMarketingPlan({...input,cost:100000}).marketing,0);
});
test('post-sale goal context does not report future sales as existing inventory cash',()=>{
 const r=salesFundedMarketingPlan(input);
 const goal=keywordGoalDiagnostics({cpc:1000,perOrder:r.perOrder,budget:r.marketing,quantity:400,months:2,cvr:10,monthlySearches:10000},{basis:'sales',available:r.sales,reserved:r.reserved,cashRoom:r.cashRoom,profitRoom:r.profitRoom});
 assert.equal(goal?.inventoryCashShortfall,null);assert.equal(goal?.extraWorkingCapital,null);
});
