import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseDataset} from '../src/lib/ad-health';
const parse=(date:string,format:'json'|'csv')=>parseDataset(format==='json'?JSON.stringify([{date,productId:'ALL',visits:1}]):`date,productId,visits\n${date},ALL,1`,'daily','synthetic');
test('invalid calendar dates produce actionable Korean row error rather than RangeError',()=>{
 for(const format of ['json','csv'] as const)for(const date of ['2026-00-01','2026-13-01','2026-01-00','2026-01-32','2026-02-29','2024-02-30','2026-04-31','2100-02-29','2026/01/01','2026-1-1']) assert.throws(()=>parse(date,format),(e:unknown)=> e instanceof Error && !(e instanceof RangeError) && /1행 날짜.*실제 존재.*YYYY-MM-DD/.test(e.message),`${format}: ${date}`);
});
test('valid leap days and ordinary boundaries preserve input',()=>{
 for(const format of ['json','csv'] as const)for(const date of ['2024-02-29','2000-02-29','2026-01-01','2026-12-31','2026-04-30']) assert.equal(parse(date,format).rows[0].date,date);
});
test('invalid later row is identified without publishing partial rows',()=>{
 assert.throws(()=>parseDataset('date,productId,visits\n2026-01-01,ALL,1\n2026-13-01,ALL,1','daily','synthetic'),/2행 날짜.*실제 존재/);
});
