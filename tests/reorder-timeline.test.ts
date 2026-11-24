import test from 'node:test';
import assert from 'node:assert/strict';
import {reorderSchedule,reorderTimeline,stockAtDay} from '../src/lib/reorder-timeline';
test('reorder time follows target duration and replenishment lead time',()=>{
 const plan=reorderTimeline(500,2,14)!;assert.equal(plan.durationDays,60);assert.equal(plan.reorderDay,46);assert.equal(plan.stockAtReorder,117);assert.equal(plan.monthlySales,250);
 const longer=reorderTimeline(500,4,14)!;assert.equal(longer.reorderDay,106);assert.equal(longer.stockAtReorder,59);
});
test('selected order date drives actual arrival and stockout separately from the recommendation',()=>{
 const plan=reorderTimeline(20,2,14)!;
 const safe=reorderSchedule(plan,'2026-11-24','2027-01-05',14)!;
 assert.equal(safe.recommended,'2027-01-05');
 assert.equal(safe.deadline,'2027-01-09');
 assert.equal(safe.depletion,'2027-01-23');
 assert.equal(safe.arrival,'2027-01-19');
 assert.equal(safe.daysAtArrival,4);
 assert.equal(stockAtDay(20,60,safe.arrivalDay!),2);
 assert.equal(safe.risk,'safe');
 const caution=reorderSchedule(plan,'2026-11-24','2027-01-07',14)!;
 assert.equal(caution.daysAtArrival,2);
 assert.equal(caution.risk,'caution');
 assert.equal(reorderSchedule(plan,'2026-11-24','2027-01-09',14)!.daysAtArrival,0);
 const late=reorderSchedule(plan,'2026-11-24','2027-01-10',14)!;
 assert.equal(late.arrival,'2027-01-24');
 assert.equal(late.daysAtArrival,-1);
 assert.equal(stockAtDay(20,60,late.arrivalDay!),0);
 assert.equal(late.risk,'risk');
});
test('coincident milestones and incomplete or out-of-range dates remain valid display cases',()=>{
 const instant=reorderTimeline(200,2,0)!;
 const same=reorderSchedule(instant,'2026-11-24','2027-01-23',0)!;
 assert.equal(same.deadline,same.depletion);
 assert.equal(same.recommended,same.arrival);
 assert.equal(same.risk,'caution');
 assert.equal(same.orderWindow,0);
 const longLead=reorderTimeline(40,1,40)!;
 assert.equal(reorderSchedule(longLead,'2026-11-24','2026-11-24',40)!.daysAtArrival,-10);
 for(const day of ['','2026-11-23','2026-11-31','9999-12-31']){
  const result=reorderSchedule(longLead,'2026-11-24',day,40)!;
  assert.equal(result.arrival,null);
  assert.equal(result.risk,'pending');
 }
 assert.equal(reorderSchedule(instant,'','2027-01-23',0),null);
 assert.equal(stockAtDay(100,50,43),14);
});
test('late lead time requires immediate ordering and zero lead time orders at depletion',()=>{
 const late=reorderTimeline(100,1,60)!;assert.equal(late.reorderDay,0);assert.equal(late.stockAtReorder,100);assert.equal(late.lateDays,30);
 const instant=reorderTimeline(100,1,0)!;assert.equal(instant.reorderDay,30);assert.equal(instant.stockAtReorder,0);
 for(const args of [[0,1,14],[10,0,14],[10,121,14],[10,2,-1],[10,2,1.5],[10,2,Infinity]])assert.equal(reorderTimeline(...args as [number,number,number]),null);
});
test('recommended order date precedes the deadline with an explicit bounded buffer',()=>{
 const regular=reorderTimeline(200,2,14)!;
 assert.equal(regular.reorderDay,46);assert.equal(regular.bufferDays,4);assert.equal(regular.recommendedDay,42);
 assert.equal(reorderTimeline(200,2,40)!.bufferDays,7);
 assert.equal(reorderTimeline(200,1,60)!.recommendedDay,0);
 const instant=reorderTimeline(200,2,0)!;assert.equal(instant.bufferDays,0);assert.equal(instant.recommendedDay,60);
});
