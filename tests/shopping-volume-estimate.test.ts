import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrateShoppingVolume,estimateShoppingVolume} from '../src/lib/shopping-volume-estimate';
import type {KeywordRow} from '../src/lib/naver-keywords';
const row=(keyword:string,pcSearches:number|string|null,mobileSearches=999999):KeywordRow=>({keyword,pcSearches,mobileSearches,pcClicks:null,mobileClicks:null,competition:'높음'});
test('uses same-device ratio of average bids and search volumes',()=>{
 const calibration=calibrateShoppingVolume([row('보조배터리',33700),row('무선충전기',6350)])!;
 assert.equal(calibration.averageVolume,20025);assert.deepEqual(calibration.averageBids,[2370,1855,1585]);
 const result=estimateShoppingVolume(row('텀블러',31700),calibration)!;
 assert.ok(Math.abs(result.bids[0]-3751.760299625468)<0.0001);
 assert.ok(result.bids[0]>result.bids[1]&&result.bids[1]>result.bids[2]);
 assert.equal(estimateShoppingVolume(row('텀블러',31700,0),calibration)!.bids[0],result.bids[0]);
 assert.equal(estimateShoppingVolume(row('텀블러',63400),calibration)!.bids[0],result.bids[0]*2);
});
test('incomplete, zero or bounded volumes do not fabricate an estimate',()=>{
 assert.equal(calibrateShoppingVolume([row('보조배터리',33700)]),null);
 const calibration=calibrateShoppingVolume([row('보조배터리',33700),row('무선충전기',6350)])!;
 for(const volume of [0,null,'< 10'])assert.equal(estimateShoppingVolume(row('텀블러',volume),calibration),null);
});
