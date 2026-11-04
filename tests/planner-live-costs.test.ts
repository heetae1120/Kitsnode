import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerLiveCosts} from '../src/lib/planner-live-costs';
import {marketingPlan} from '../src/lib/marketing-plan';
const input={price:28500,cost:12000,quantity:100,available:2000000,feePercent:7,logistics:3000,packaging:500,returnRate:5,returnHandling:5000};
test('return rates allocate a handling allowance and agree with the final report',()=>{
 const live=plannerLiveCosts(input);
 assert.equal(live.returns,250);assert.equal(live.unitCost,17745);assert.equal(live.profit,10755);
 assert.equal(live.stockCost,1200000);assert.equal(live.remaining,225500);
 const report=marketingPlan({...input,returns:live.returns,certification:0,fixed:0});
 assert.equal(live.unitCost,report.variable);assert.equal(live.profit,report.margin);assert.equal(live.remaining,report.cashRoom);
});
test('losses and negative remaining budgets are preserved rather than clamped',()=>{
 const live=plannerLiveCosts({...input,cost:30000});assert.ok(live.profit<0);assert.ok(live.remaining<0);
 assert.equal(plannerLiveCosts({...input,returnRate:0}).returns,0);
});
test('invalid rates, quantities and overflowing amounts cannot create plausible estimates',()=>{
 for(const patch of [{returnRate:101},{feePercent:101},{quantity:0},{quantity:1.2},{cost:-1},{returnHandling:Infinity},{price:Number.MAX_VALUE,quantity:100}])assert.throws(()=>plannerLiveCosts({...input,...patch}));
});
