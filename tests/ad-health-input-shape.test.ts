import {test} from 'node:test';import assert from 'node:assert/strict';import {parseDataset,summarize} from '../src/lib/ad-health';
const record={date:'2026-11-01',productId:'ALL',orders:1};
test('whitespace CSV metric is missing rather than a measured zero',()=>{const result=parseDataset('date,productId,visits,orders\n2026-11-01,ALL,   ,1','daily','fixture.csv');assert.equal(result.rows[0].visits,undefined);assert.equal(summarize(result.rows).visits,null)});
for(const value of [[],[10],["10"]]) test('JSON array metric is rejected: '+JSON.stringify(value),()=>{assert.throws(()=>parseDataset(JSON.stringify([{...record,visits:value}]),'daily','fixture.json'),/형식|숫자|유효/)});
test('aliased JSON duplicate metric cannot silently overwrite a value',()=>{assert.throws(()=>parseDataset(JSON.stringify([{...record,visits:10,방문수:999}]),'daily','fixture.json'),/중복/)});
test('explicit numeric zero and formatted numeric strings remain valid',()=>{const result=parseDataset(JSON.stringify([{...record,visits:0,revenue:'1,000'}]),'daily','fixture.json');assert.equal(result.rows[0].visits,0);assert.equal(result.rows[0].revenue,1000)});
