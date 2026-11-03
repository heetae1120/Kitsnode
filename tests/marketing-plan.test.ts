import test from 'node:test';
import assert from 'node:assert/strict';
import {marketingPlan, resolvePlanBudget, type MarketingPlanInput} from '../src/lib/marketing-plan';
const input: MarketingPlanInput = {price:30000,cost:10000,quantity:100,available:2000000,feePercent:5,logistics:3000,packaging:500,returns:0,certification:100000,fixed:0};
test('reserves all costs and caps marketing by both cash and profit',()=>{
  const r=marketingPlan(input);
  assert.equal(r.variable,15000); assert.equal(r.reserved,1600000);
  assert.equal(r.marketing,400000); assert.equal(r.profit,1000000);
  assert.equal(r.breakEvenUnits,34); assert.equal(r.perOrder,14000);
  assert.equal(marketingPlan({...input,available:5000000}).marketing,1400000);
});
test('insufficient cash and unprofitable products cannot fund marketing',()=>{
  assert.equal(marketingPlan({...input,available:100}).marketing,0);
  const r=marketingPlan({...input,cost:40000});
  assert.equal(r.marketing,0); assert.equal(r.breakEvenUnits,null); assert.equal(r.breakEvenRoas,null);
});
test('zero fees are valid but invalid numeric inputs are rejected',()=>{
  assert.doesNotThrow(()=>marketingPlan({...input,feePercent:0,certification:0}));
  for(const change of [{quantity:0},{quantity:1.5},{price:0},{cost:-1},{available:NaN},{feePercent:101},{fixed:Infinity}]) assert.throws(()=>marketingPlan({...input,...change}));
});

test('split budget is summed once and marketing plan caps spend',()=>{
 assert.deepEqual(resolvePlanBudget('split','1600000','200000','99999999'),{available:1800000,purchaseBudget:1600000,marketingBudget:200000});
 assert.equal(marketingPlan({...input,...resolvePlanBudget('split','2000000','100000','')}).marketing,100000);
 assert.equal(marketingPlan({...input,marketingBudget:0}).marketing,0);
 assert.equal(marketingPlan({...input,available:5000000,marketingBudget:9000000}).marketing,1400000);
});
test('total-only mode ignores saved split fields and validates blanks',()=>{
 assert.deepEqual(resolvePlanBudget('total','1000000','500000','2000000'),{available:2000000});
 assert.throws(()=>resolvePlanBudget('split','','1000','2000'));
 assert.throws(()=>resolvePlanBudget('total','','',''));
 assert.throws(()=>resolvePlanBudget('split','-1','10',''));
});
