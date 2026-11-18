import test from 'node:test';
import assert from 'node:assert/strict';
import {goalMotionFrame,GOAL_MONTH_END,GOAL_COUNT_START,GOAL_COUNT_END} from '../src/lib/goal-motion';

test('months count first while the amount stays zero, then both retain their final values',()=>{
 assert.deepEqual([goalMotionFrame(0,2,2450000).months,goalMotionFrame(0,2,2450000).count],[0,0]);
 for(let t=0;t<=GOAL_MONTH_END;t+=20)assert.equal(goalMotionFrame(t,2,2450000).count,0);
 assert.equal(goalMotionFrame(GOAL_MONTH_END,2,2450000).months,2);
 const during=goalMotionFrame(GOAL_COUNT_START+300,2,2450000);
 assert.equal(during.months,2);assert(during.count>0&&during.count<2450000);
 for(const t of [GOAL_COUNT_END,7000,12000]){const final=goalMotionFrame(t,2,2450000);assert.equal(final.months,2);assert.equal(final.count,2450000);assert.equal(final.phase,'complete');}
});
test('counting uses actual values, eases out and lands on exact rounded signed amounts',()=>{
 for(const target of [8700000,544800,0,-240000,1234.56]){
  let previous=0;
  for(let t=GOAL_COUNT_START;t<=GOAL_COUNT_END;t+=10){const next=goalMotionFrame(t,12,target);assert.equal(next.months,12);assert(target>=0?next.count>=previous:next.count<=previous);previous=next.count;}
  assert.equal(goalMotionFrame(GOAL_COUNT_END,12,target).count,Math.round(target));
 }
 const early=goalMotionFrame(GOAL_COUNT_START+200,2,8700000).count;
 const late=8700000-goalMotionFrame(GOAL_COUNT_END-200,2,8700000).count;
 assert(early>late);
});
