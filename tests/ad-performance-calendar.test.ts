import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,nextRange} from '../src/components/store/ad-performance-calendar';

test('calendar includes leap day and aligns the first day of each month',()=>{
 const days=calendarDays('2024-02');
 assert.equal(days.indexOf('2024-02-01'),4);
 assert.equal(days.at(-1),'2024-02-29');
 assert.equal(calendarDays('2025-02').at(-1),'2025-02-28');
 assert.deepEqual(calendarDays(''),[]);
});
test('range selection restarts after completion or an earlier date',()=>{
 assert.deepEqual(nextRange('2026-11-10','',''),['2026-11-10','']);
 assert.deepEqual(nextRange('2026-11-15','2026-11-10',''),['2026-11-10','2026-11-15']);
 assert.deepEqual(nextRange('2026-11-05','2026-11-10',''),['2026-11-05','']);
 assert.deepEqual(nextRange('2026-11-20','2026-11-10','2026-11-15'),['2026-11-20','']);
});
