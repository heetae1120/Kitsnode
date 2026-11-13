import test from 'node:test';
import assert from 'node:assert/strict';
import {keywordGoal} from '../src/lib/keyword-goal';
const input={cpc:500,perOrder:10000,budget:250000,quantity:145,months:1,cvr:29,monthlySearches:500};
test('exactly sufficient whole clicks do not add an unnecessary click',()=>{const result=keywordGoal(input)!;assert.equal(result.neededClicks,500);assert.equal(result.neededBudget,250000);assert.equal(result.extraBudget,0);assert.equal(result.requiredShare,100);});
test('fractional clicks still round upward',()=>{const result=keywordGoal({...input,quantity:146})!;assert.equal(result.neededClicks,504);});
test('extreme click requirements fail closed without correction loops',()=>assert.equal(keywordGoal({...input,cvr:Number.MIN_VALUE}),null));
test('returned count is sufficient and the previous count is insufficient',()=>{
 for(let cvr=1;cvr<=100;cvr++)for(let quantity=1;quantity<=150;quantity++){
  const result=keywordGoal({...input,cvr,quantity})!;
  assert.ok(result.neededClicks*(cvr/100)>=quantity);
  assert.ok((result.neededClicks-1)*(cvr/100)<quantity);
 }
});
