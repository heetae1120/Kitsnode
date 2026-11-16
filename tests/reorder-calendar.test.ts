import test from 'node:test';
import assert from 'node:assert/strict';
import {dateAfter,calendarMonth} from '../src/lib/reorder-calendar';
test('calendar offsets cross month and year boundaries without timezone shifts',()=>{
 assert.equal(dateAfter('2026-11-16',72),'2027-01-27');assert.equal(dateAfter('2026-11-16',76),'2027-01-31');
 assert.equal(dateAfter('2024-02-28',1),'2024-02-29');assert.equal(dateAfter('2026-02-30',0),null);
});
test('calendar aligns weekdays and navigates across a year',()=>{
 const feb=calendarMonth('2024-02-29')!;assert.equal(feb.cells.filter(Boolean).length,29);assert.equal(feb.cells[4],'2024-02-01');
 assert.equal(calendarMonth('2026-12-10',1)!.key,'2027-01');assert.equal(calendarMonth('bad'),null);
});
