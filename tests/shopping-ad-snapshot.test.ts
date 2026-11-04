import test from 'node:test';
import assert from 'node:assert/strict';
import observations from '../src/data/shopping-ad-observations.json';
import {validateShoppingAdSnapshot,shoppingSearchUrl} from '../src/lib/shopping-ad-snapshot';
const observation=observations[0];const now=Date.parse(observation.observedAt)+1000;
test('actual browser observations retain their time, keyword and explicit ad ranks',()=>{
 const result=validateShoppingAdSnapshot(observation,'가습기',now);
 assert.equal(result.observedAt,observation.observedAt);assert.deepEqual(result.items.map(row=>row.rank),[1,2,3]);
 assert.equal(result.items[0].price,298000);assert.equal(result.items[1].mall,'오브룸 스토어');
});
test('other queries, organic results, duplicate positions and missing timestamps are rejected',()=>{
 for(const patch of [{keyword:'텀블러'},{device:'MOBILE'},{observedAt:''},{observedAt:new Date(now+120000).toISOString()},{sourceUrl:shoppingSearchUrl('텀블러')},{sourceUrl:'https://evil.test/search/all?query=가습기'},{items:[{...observation.items[0],ad:false}]},{items:[observation.items[0],observation.items[0]]}])assert.throws(()=>validateShoppingAdSnapshot({...observation,...patch},'가습기',now));
});
test('partial results keep original ranks and unavailable images and prices stay missing',()=>{
 const result=validateShoppingAdSnapshot({...observation,complete:false,items:[{...observation.items[2],price:null,image:'https://evil.test/fake.png'}]},'가습기',now);
 assert.deepEqual(result.items.map(row=>row.rank),[3]);assert.equal(result.items[0].image,null);assert.equal(result.items[0].price,null);
 assert.equal(new URL(shoppingSearchUrl('가습기 & 시계')).searchParams.get('query'),'가습기 & 시계');
});
