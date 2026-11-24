import test from 'node:test';
import assert from 'node:assert/strict';
import {dateAfter,daysBetween,calendarMonth} from '../src/lib/reorder-calendar';
test('calendar offsets cross month and year boundaries without timezone shifts',()=>{
 assert.equal(dateAfter('2026-11-16',72),'2027-01-27');assert.equal(dateAfter('2026-11-16',76),'2027-01-31');
 assert.equal(dateAfter('2024-02-28',1),'2024-02-29');assert.equal(dateAfter('2026-02-30',0),null);
});
test('date-only arithmetic handles signed days, leap dates and invalid bounds',()=>{
 assert.equal(daysBetween('2026-11-24','2027-01-05'),42);
 assert.equal(daysBetween('2024-03-01','2024-02-28'),-2);
 assert.equal(daysBetween('2026-11-24','2026-11-24'),0);
 assert.equal(daysBetween('2026-02-30','2026-03-01'),null);
 assert.equal(dateAfter('9999-12-31',1),null);
 assert.equal(dateAfter('0001-01-01',-1),null);
 assert.equal(dateAfter('2026-11-24',Number.MAX_SAFE_INTEGER),null);
});
test('calendar aligns weekdays and navigates across a year',()=>{
 const feb=calendarMonth('2024-02-29')!;assert.equal(feb.cells.filter(Boolean).length,29);assert.equal(feb.cells[4],'2024-02-01');
 assert.equal(calendarMonth('2026-12-10',1)!.key,'2027-01');assert.equal(calendarMonth('bad'),null);
});
