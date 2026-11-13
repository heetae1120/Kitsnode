import test from 'node:test';
import assert from 'node:assert/strict';
import {countRange,validateKeywordResponse} from '../src/lib/naver-keywords';
import {parseProductCount} from '../src/lib/keyword-research';
for(const value of ['1,2','1,,000',',100','100,'])test(`invalid grouped counts stay unknown ${value}`,()=>assert.equal(countRange(value),null));
test('invalid bounded count stays unknown',()=>assert.equal(countRange('<1,0'),null));
for(const value of ['1,2','1,,000',',100','100,',','])test(`manual malformed count rejected ${value}`,()=>assert.throws(()=>parseProductCount(value),/정수/));
test('valid grouped counts and bounds preserved',()=>{assert.deepEqual(countRange(' 1,000 '),{min:1000,max:1000});assert.deepEqual(countRange('< 1,000'),{min:0,max:999});assert.equal(parseProductCount(' 1,000 '),1000);assert.equal(parseProductCount(' '),null);assert.deepEqual(countRange('001'),{min:1,max:1});});
test('malformed API count does not become a false exact volume',()=>{const result=validateKeywordResponse({source:'naver',queriedKeywords:['test'],fetchedAt:'2026-11-01T00:00:00Z',keywords:[{keyword:'test',pcSearches:'1,2',mobileSearches:100}]});assert.equal(result.keywords[0].pcSearches,null);});
