import test from "node:test";
import assert from "node:assert/strict";
import { marketingTestBudget } from "../src/lib/marketing-test-budget";
import { marketingPlan, type MarketingPlanInput } from "../src/lib/marketing-plan";

const input: MarketingPlanInput = { price:36000,cost:15000,quantity:2000,available:50000000,feePercent:7,logistics:0,packaging:0,returns:0,certification:0,fixed:0 };
test("total funds get a small test budget with the matching break-even quantity", () => {
  assert.deepEqual(marketingTestBudget(input), {amount:1496000,heldBack:13464000,breakEvenUnits:81});
  const withFixed = {...input,fixed:100000};
  const suggestion = marketingTestBudget(withFixed)!;
  assert.equal(suggestion.breakEvenUnits,Math.ceil((100000+suggestion.amount)/marketingPlan(withFixed).margin));
  assert.ok(suggestion.amount<=marketingPlan(withFixed).marketing);
});
test("no test spend is suggested for an explicit budget or an unviable plan", () => {
  assert.equal(marketingTestBudget({...input,marketingBudget:100000}),null);
  assert.equal(marketingTestBudget({...input,available:100}),null);
  assert.equal(marketingTestBudget({...input,cost:40000}),null);
});
test("small available funds never produce an amount above the spending ceiling", () => {
  const small={...input,available:marketingPlan(input).reserved+1};
  assert.equal(marketingTestBudget(small)!.amount,1);
  assert.equal(marketingTestBudget(small)!.heldBack,0);
});
