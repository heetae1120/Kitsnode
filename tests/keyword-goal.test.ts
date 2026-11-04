import test from 'node:test';
import assert from 'node:assert/strict';
import {breakEvenConversion,keywordGoal} from '../src/lib/keyword-goal';
const input={cpc:500,perOrder:25000,budget:1000000,quantity:100,months:3,cvr:5,monthlySearches:10000};
test('break-even conversion includes CPC and the profit available per order',()=>{
 assert.ok(Math.abs(breakEvenConversion(550,25000)!-2.2)<1e-10);
 assert.equal(breakEvenConversion(100,0),null);
 assert.equal(breakEvenConversion(Infinity,100),null);
 assert.equal(breakEvenConversion(200,100),200);
});
test('target calculation respects whole clicks, budget and the selected horizon',()=>{
 const g=keywordGoal(input)!;
 assert.equal(g.neededClicks,2000);assert.equal(g.neededBudget,1000000);
 assert.equal(g.budgetOrders,100);assert.equal(g.demandOrders,1500);
 assert.equal(g.status,'conditional');assert.equal(g.requiredShare,2000/30000*100);
 assert.equal(keywordGoal({...input,monthlySearches:100,months:1})!.status,'demand');
 assert.equal(keywordGoal({...input,monthlySearches:100,months:20})!.status,'conditional');
});
test('funding and search-demand shortfalls are independent; zero is not missing data',()=>{
 const g=keywordGoal({...input,budget:500000})!;
 assert.equal(g.status,'budget');assert.equal(g.extraBudget,500000);assert.equal(g.requiredCvr,10);
 assert.equal(keywordGoal({...input,budget:0})!.budgetOrders,0);
 assert.equal(keywordGoal({...input,budget:0})!.requiredCvr,null);
 assert.equal(keywordGoal({...input,budget:0,monthlySearches:0})!.status,'both');
 assert.equal(keywordGoal({...input,monthlySearches:null})!.status,'unknown');
 assert.equal(keywordGoal({...input,monthlySearches:0})!.status,'demand');
});
test('loss-making sales are identified before suggesting more spending',()=>{
 assert.equal(keywordGoal({...input,cvr:1})!.status,'loss');
 assert.equal(keywordGoal({...input,perOrder:0})!.status,'loss');
});
test('invalid or overflowing inputs do not produce a feasible result',()=>{
 for(const patch of [{cvr:0},{cvr:101},{months:0},{months:1.5},{quantity:0},{budget:-1},{cpc:Infinity},{monthlySearches:-1},{budget:Number.MAX_VALUE,cpc:Number.MIN_VALUE}])assert.equal(keywordGoal({...input,...patch}),null);
});
