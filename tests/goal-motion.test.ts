import test from 'node:test';
import assert from 'node:assert/strict';
import {goalMotionFrame,GOAL_MOTION_DURATION,GOAL_COUNT_START,GOAL_COUNT_END} from '../src/lib/goal-motion';

test('four scenes follow the seven-second timing contract',()=>{
 for(const [time,phase] of [[0,'period'],[1499,'period'],[1500,'amount'],[3500,'question'],[5000,'invitation'],[GOAL_MOTION_DURATION,'complete']] as const)assert.equal(goalMotionFrame(time,8700000).phase,phase);
});
test('count is monotonic, eases out and lands exactly on the actual rounded profit',()=>{
 for(const target of [8700000,544800,0,-240000,1234.56]){
  assert.equal(goalMotionFrame(GOAL_COUNT_START,target).count,0);
  assert.equal(goalMotionFrame(GOAL_COUNT_END,target).count,Math.round(target));
  assert.equal(goalMotionFrame(7000,target).count,Math.round(target));
  let previous=0;
  for(let t=GOAL_COUNT_START;t<=GOAL_COUNT_END;t+=10){const next=goalMotionFrame(t,target).count;assert(target>=0?next>=previous:next<=previous);previous=next;}
 }
 const early=goalMotionFrame(GOAL_COUNT_START+200,8700000).count;
 const late=8700000-goalMotionFrame(GOAL_COUNT_END-200,8700000).count;
 assert(early>late);
 assert.equal(goalMotionFrame(3500,8700000).countDone,true);
});
