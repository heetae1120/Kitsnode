import test from 'node:test';
import assert from 'node:assert/strict';
import {productKeywordSeed,selectProductKeywords} from '../src/lib/product-keywords';
import type {KeywordRow} from '../src/lib/naver-keywords';
const row=(keyword:string,volume:number):KeywordRow=>({keyword,pcSearches:volume,mobileSearches:0,pcClicks:null,mobileClicks:null,competition:'높음'});
test('a descriptive product supplies a noun seed without extra input',()=>{assert.equal(productKeywordSeed('프리미엄 탁상용 미니 가습기'),'가습기');assert.throws(()=>productKeywordSeed('!!!'));});
test('related discovery keeps the exact main and only relevant long-tail candidates',()=>{
 const result=selectProductKeywords('가습기',[row('가습기',100),row('미니가습기',80),row('탁상용가습기',60),row('무선가습기',50),row('자동차',9999),row('대형가습기',30)]);
 assert.deepEqual(result.map(row=>row.keyword),['가습기','미니가습기','탁상용가습기','무선가습기']);assert.deepEqual(selectProductKeywords('원피스',[row('가습기',100)]),[]);
});
