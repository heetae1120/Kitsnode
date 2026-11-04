import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeObservedAds} from '../keyword-api/src/browser-shopping-ads.mjs';
import observations from '../src/data/shopping-ad-observations.json';
import {createShoppingAdsHandler} from '../keyword-api/src/shopping-ads-handler.mjs';
test('link collection keeps actual ad order and never uses an organic or unnamed item',()=>{
 const result=normalizeObservedAds([{ad:true,title:'첫 광고',price:1000},{ad:true,title:'둘째 광고',price:0}]);
 assert.deepEqual(result.items.map(row=>row.rank),[1,2]);assert.equal(result.complete,false);assert.equal(result.items[1].price,null);
 assert.throws(()=>normalizeObservedAds([]));assert.throws(()=>normalizeObservedAds([{ad:false,title:'일반 상품'}]));assert.throws(()=>normalizeObservedAds([{ad:true,title:''}]));
});
test('default API path opens the shopping link through its browser collector without an external API',async()=>{
 const handle=createShoppingAdsHandler({browserCollector:async(keyword:string)=>({...observations[0],keyword})});
 const request=()=>new Request('https://example.com/api/shopping-ads?keyword=가습기',{headers:{origin:'https://heetae1120.github.io'}});
 const response=await handle(request(),{});assert.equal(response.status,200);assert.equal((await response.json()).keyword,'가습기');
 const limited=createShoppingAdsHandler({maxRequests:1,browserCollector:async()=>observations[0]});
 assert.equal((await limited(request(),{},'same-client')).status,200);assert.equal((await limited(request(),{},'same-client')).status,429);
});
