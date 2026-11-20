import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingPublicProduct,publicProductUrl,publicAdProductDetails} from '../keyword-api/src/integrated-ad-details.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {shoppingAdVisitUrl} from '../src/lib/shopping-ad-snapshot';
import {normalizeObservedAds} from '../keyword-api/src/browser-shopping-ads.mjs';
test('review supplements require an exact product and seller and exclude ads and bundles',()=>{
 const ad={title:'케어팟 X55V 가습기',mall:'carepod'};
 const exact={ad:false,title:'케어팟 X55V 가습기',mall:'carepod',rating:4.84,reviewCount:'1,352'};
 assert.equal(matchingPublicProduct(ad,[{...exact,ad:true},{...exact,title:'[1+1] 케어팟 X55V 가습기'},{...exact,title:'케어팟 X50V 가습기'},{...exact,mall:'다른 판매처'}]),null);
 assert.equal(matchingPublicProduct(ad,[{...exact,title:'케어팟  X55V 가습기'}])?.reviewCount,'1,352');
 assert.equal(matchingPublicProduct({...ad,mall:''},[exact]),null);
});
test('public links remove tracking parameters and never send product visits to search or paid redirects',()=>{
 const product='https://smartstore.naver.com/main/products/13771475773';
 assert.equal(publicProductUrl(product+'?NaPm=tracking'),product);
 for(const url of ['https://ader.naver.com/v1/session','https://cr3.shopping.naver.com/v2/bridge/searchGate?nv_mid=1','https://nid.naver.com/nidlogin.login','https://smartstore.naver.com.evil.test/a/products/1']){
  assert.equal(publicProductUrl(url),null);
  assert.equal(shoppingAdVisitUrl({title:'정확한 상품명',url}),null);
 }
 assert.equal(shoppingAdVisitUrl({title:'상품',url:product+'?tracking=1'}),product);
});
test('public ad metadata resolves the exact selling product even when creative copy differs from its title',()=>{
 const row={nvMid:'91315987137',title:'케어팟 원격으로 쉽고 위생적인 가습기 관리',productData:{nvMid:91315987137,channelProductId:'13771475773',productUrl:'https://smartstore.naver.com/main/products/13771475773?tracking=1',rating:4.84,reviewCount:1383,purchaseCount:4392,wishCount:4617}};
 assert.deepEqual(publicAdProductDetails(row),{url:'https://smartstore.naver.com/main/products/13771475773',rating:4.84,reviewCount:'1,383',purchaseCount:'4,392',wishCount:'4,617'});
 assert.deepEqual(publicAdProductDetails({...row,nvMid:'other'}),{});
 assert.deepEqual(publicAdProductDetails({...row,productData:{...row.productData,channelProductId:'another'}}),{});
 const zero=publicAdProductDetails({...row,productData:{...row.productData,rating:0,reviewCount:0,purchaseCount:0,wishCount:0}});
 assert.equal(zero.reviewCount,'0');assert.equal(zero.purchaseCount,'0');assert.equal(zero.rating,0);
 assert.equal(publicAdProductDetails({...row,productData:{...row.productData,reviewCount:-1,purchaseCount:null}}).reviewCount,undefined);
});
test('merchant fallback reads only the current product and does not transfer recommendation counters',()=>{
 const module=readFileSync(new URL('../keyword-api/src/integrated-ad-details.mjs',import.meta.url),'utf8');
 const source=module.slice(module.indexOf('export function readMerchantProductDetails')).replace(/^export /,'');
 const read=(expectedId:string,pathname='/main/products/123')=>JSON.parse(JSON.stringify(runInNewContext('('+source+')(expectedId)',{expectedId,location:{pathname},window:{__PRELOADED_STATE__:{product:{id:123,reviewAmount:{averageReviewScore:4.8,totalReviewCount:42},purchaseCount:81,keepCount:0},recommendations:[{id:999,averageReviewScore:5,totalReviewCount:999,purchaseCount:999}]}},document:{querySelectorAll:()=>[]}})));
 assert.deepEqual(read('123'),{rating:4.8,reviewCount:'42',purchaseCount:'81',wishCount:'0'});
 assert.deepEqual(read('999'),{});assert.deepEqual(read(''),{});assert.deepEqual(read('123','/login'),{});
});
test('visible purchase badges are retained even when span counters are empty',()=>{
 const [item]=normalizeObservedAds([{ad:true,title:'아이닉',periodText:'구매 1천+\n찜 4,059',purchaseCount:'',wishCount:''}]).items;
 assert.equal(item.purchaseCount,'1천+');assert.equal(item.wishCount,'4,059');
});
