import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDataset} from '../src/lib/ad-health';
const parse=(v:unknown,key='revenue')=>parseDataset(JSON.stringify([{date:'2026-11-01',productId:'ALL',[key]:v}]),'daily','synthetic.json').rows[0];
for(const value of ['1,2',',','0x10','0b10','0o10','1,,000',',100','100,','12,34,567','1e3','Infinity','1 000'])test(`reject malformed metric ${value}`,()=>assert.throws(()=>parse(value),/숫자 형식/));
for(const [value,expected] of [['0',0],['001',1],['1000',1000],['1,000',1000],['12,345,678',12345678],[' 1,000 ',1000],['1000.0',1000]] as const)test(`preserve decimal metric ${value}`,()=>assert.equal(parse(value).revenue,expected));
for(const [value,expected] of [['1.25',1.25],['1,000.25',1000.25],['.5',.5],['0.5',.5]] as const)test(`preserve dwell decimal ${value}`,()=>assert.equal(parse(value,'dwellSeconds').dwellSeconds,expected));
test('numeric JSON values remain valid',()=>assert.equal(parse(1000).revenue,1000));
test('fractional counts stay prohibited',()=>assert.throws(()=>parse('1.5','visits'),/정수/));
test('quoted CSV grouped amount is valid',()=>assert.equal(parseDataset('date,productId,revenue\n2026-11-01,ALL,"1,000"','daily','synthetic.csv').rows[0].revenue,1000));

test('unsupported Excel/scientific strings explain conversion',()=>{for(const value of ['1e3','+1','1.'])assert.throws(()=>parse(value),/일반 숫자.*Excel.*1000/);});

test('format guidance limits decimal permission to dwell time',()=>assert.throws(()=>parse('1e3','visits'),/소수는 체류시간초에만 허용/));
