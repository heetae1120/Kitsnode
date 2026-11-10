import test from 'node:test';
import assert from 'node:assert/strict';
import observations from '../src/data/shopping-ad-observations.json';
import {validateShoppingAdSnapshot,shoppingSearchUrl} from '../src/lib/shopping-ad-snapshot';
const observation=observations[0];const now=Date.parse(observation.observedAt)+1000;
test('actual browser observations retain their time, keyword and explicit ad ranks',()=>{
 const result=validateShoppingAdSnapshot(observation,'가습기',now);
 assert.equal(result.observedAt,observation.observedAt);assert.deepEqual(result.items.map(row=>row.rank),[1,2,3]);
 assert.equal(result.items[0].price,298000);assert.equal(result.items[1].mall,observation.items[1].mall);
});
test('other queries, organic results, duplicate positions and missing timestamps are rejected',()=>{
 for(const patch of [{keyword:'텀블러'},{device:'MOBILE'},{observedAt:''},{observedAt:new Date(now+120000).toISOString()},{sourceUrl:shoppingSearchUrl('텀블러')},{sourceUrl:'https://evil.test/search/all?query=가습기'},{items:[{...observation.items[0],ad:false}]},{items:[observation.items[0],observation.items[0]]}])assert.throws(()=>validateShoppingAdSnapshot({...observation,...patch},'가습기',now));
});
test('partial results keep original ranks and unavailable images and prices stay missing',()=>{
 const result=validateShoppingAdSnapshot({...observation,complete:false,items:[{...observation.items[2],price:null,image:'https://evil.test/fake.png'}]},'가습기',now);
 assert.deepEqual(result.items.map(row=>row.rank),[3]);assert.equal(result.items[0].image,null);assert.equal(result.items[0].price,null);
 assert.equal(new URL(shoppingSearchUrl('가습기 & 시계')).searchParams.get('query'),'가습기 & 시계');
});

test('review metadata preserves observed values and drops invalid values',()=>{
 const sample={...observation,items:[{...observation.items[0],rating:4.88,reviewCount:'490',originalPrice:328000,couponPrice:268200}]};
 const item=validateShoppingAdSnapshot(sample,'가습기',now).items[0];assert.equal(item.rating,4.88);assert.equal(item.reviewCount,'490');assert.equal(item.couponPrice,268200);
 const invalid=validateShoppingAdSnapshot({...sample,items:[{...sample.items[0],rating:6,reviewCount:123,couponPrice:-1}]},'가습기',now).items[0];assert.equal(invalid.rating,null);assert.equal(invalid.reviewCount,'');assert.equal(invalid.couponPrice,null);
});

test('only bounded JPEG captures survive validation, with rank and query intact',()=>{
 const capture='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,1,2,3,255,217]).toString('base64');
 const item={...observation.items[0],capture};
 assert.equal(validateShoppingAdSnapshot({...observation,items:[item]},'가습기',now).items[0].capture,capture);
 for(const invalid of ['data:image/svg+xml;base64,PHN2Zz4=',capture.slice(0,-4),'https://evil.test/capture.jpg',capture+'x'.repeat(350000)])assert.throws(()=>validateShoppingAdSnapshot({...observation,items:[{...item,capture:invalid}]},'가습기',now));
 assert.equal(new URL(shoppingSearchUrl('가습기 & 시계')).searchParams.get('frm'),'NVSCPRO');
});

test('integrated search is a separate placement and cannot masquerade as the shopping page',()=>{
 const sample={...observation,placement:'integrated',sourceUrl:'https://search.naver.com/search.naver?query='+encodeURIComponent('가습기')};
 const result=validateShoppingAdSnapshot(sample,'가습기',now);assert.equal(result.placement,'integrated');
 for(const patch of [{placement:undefined},{placement:'shopping'},{sourceUrl:shoppingSearchUrl('가습기')},{sourceUrl:'https://search.naver.com.evil.test/search.naver?query=가습기'},{sourceUrl:'https://search.naver.com/search.naver?query=시계'}])assert.throws(()=>validateShoppingAdSnapshot({...sample,...patch},'가습기',now));
});
