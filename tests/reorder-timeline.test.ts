import test from 'node:test';
import assert from 'node:assert/strict';
import {reorderTimeline} from '../src/lib/reorder-timeline';
test('reorder time follows target duration and replenishment lead time',()=>{
 const plan=reorderTimeline(500,2,14)!;assert.equal(plan.durationDays,60);assert.equal(plan.reorderDay,46);assert.equal(plan.stockAtReorder,117);assert.equal(plan.monthlySales,250);
 const longer=reorderTimeline(500,4,14)!;assert.equal(longer.reorderDay,106);assert.equal(longer.stockAtReorder,59);
});
test('late lead time requires immediate ordering and zero lead time orders at depletion',()=>{
 const late=reorderTimeline(100,1,60)!;assert.equal(late.reorderDay,0);assert.equal(late.stockAtReorder,100);assert.equal(late.lateDays,30);
 const instant=reorderTimeline(100,1,0)!;assert.equal(instant.reorderDay,30);assert.equal(instant.stockAtReorder,0);
 for(const args of [[0,1,14],[10,0,14],[10,121,14],[10,2,-1],[10,2,1.5],[10,2,Infinity]])assert.equal(reorderTimeline(...args as [number,number,number]),null);
});
