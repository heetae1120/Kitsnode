import test from 'node:test';
import assert from 'node:assert/strict';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';
const input={cpc:100,perOrder:3000,budget:0,quantity:100,months:2,cvr:5,monthlySearches:500};
test('zero advertising budget distinguishes inventory cash deficit and search shortage from losses',()=>{
 const result=keywordGoalDiagnostics(input,{available:1000,reserved:5000,cashRoom:-4000,profitRoom:300000})!;
 assert.equal(result.goal.neededBudget,200000);assert.equal(result.goal.extraBudget,200000);
 assert.equal(result.extraWorkingCapital,204000);assert.equal(result.inventoryCashShortfall,4000);
 assert.equal(result.goal.requiredCvr,null);assert.equal(result.unitAdLoss,0);assert.equal(result.missingClicks,1000);
});
test('more cash does not resolve unprofitable ads',()=>{
 const result=keywordGoalDiagnostics({...input,budget:300000,perOrder:1000,monthlySearches:null})!;
 assert.equal(result.goal.budgetShort,false);assert.equal(result.goal.loss,true);assert.equal(result.unitAdLoss,1000);assert.equal(result.totalSearches,null);
});
