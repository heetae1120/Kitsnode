import test from 'node:test';
import assert from 'node:assert/strict';
import {csvRows,parseDataset} from '../src/lib/ad-health';
for(const value of ['12"3"','"12"3','"1" "2"'])test(`reject misplaced quotes ${value}`,()=>assert.throws(()=>csvRows(`date,productId,revenue\n2026-11-01,ALL,${value}`),/CSV/));
test('valid quoted commas and escaped quotes preserved',()=>assert.deepEqual(csvRows('"상품,명","a""b"\r\n"multi\nline",10'),[['상품,명','a"b'],['multi\nline','10']]));
test('valid numeric quoted fields remain accepted',()=>assert.equal(parseDataset('date,productId,revenue\n2026-11-01,ALL,"1,000"','daily','synthetic.csv').rows[0].revenue,1000));
