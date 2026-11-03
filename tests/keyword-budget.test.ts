import test from 'node:test';
import assert from 'node:assert/strict';
import {matchKeywordCategory,keywordEconomics} from '../src/lib/keyword-budget';
test('only measured keyword themes receive a matching category',()=>{assert.equal(matchKeywordCategory('무선 충전기')?.id,'wireless');assert.equal(matchKeywordCategory('미니 보조배터리')?.id,'battery');assert.equal(matchKeywordCategory('신발'),null);assert.equal(matchKeywordCategory('무선충전기 케이스'),null);});
test('CPC is converted to acquisition cost before comparing margin',()=>{const result=keywordEconomics(1580,2,18480,14960000)!;assert.equal(result.cpa,79000);assert.equal(result.affordable,false);assert.equal(result.contribution,-60520);assert.equal(keywordEconomics(100,10,18480,1000)?.affordable,true);});
test('invalid conversion inputs never produce forecasts',()=>{for(const cvr of [0,-1,101,NaN])assert.equal(keywordEconomics(100,cvr,10000,1000),null);assert.equal(keywordEconomics(100,2,0,1000)?.requiredCvr,null);});
