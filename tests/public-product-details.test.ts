import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingPublicProduct,publicProductUrl} from '../keyword-api/src/integrated-ad-details.mjs';
import {shoppingAdVisitUrl} from '../src/lib/shopping-ad-snapshot';
import {normalizeObservedAds} from '../keyword-api/src/browser-shopping-ads.mjs';
test('review supplements require an exact product and seller and exclude ads and bundles',()=>{
 const ad={title:'케어팟 X55V 가습기',mall:'carepod'};
 const exact={ad:false,title:'케어팟 X55V 가습기',mall:'carepod',rating:4.84,reviewCount:'1,352'};
 assert.equal(matchingPublicProduct(ad,[{...exact,ad:true},{...exact,title:'[1+1] 케어팟 X55V 가습기'},{...exact,title:'케어팟 X50V 가습기'},{...exact,mall:'다른 판매처'}]),null);
 assert.equal(matchingPublicProduct(ad,[{...exact,title:'케어팟  X55V 가습기'}])?.reviewCount,'1,352');
 assert.equal(matchingPublicProduct({...ad,mall:''},[exact]),null);
});
test('public links remove tracking parameters and replace login or paid redirects with a title search',()=>{
 const product='https://smartstore.naver.com/main/products/13771475773';
 assert.equal(publicProductUrl(product+'?NaPm=tracking'),product);
 for(const url of ['https://ader.naver.com/v1/session','https://cr3.shopping.naver.com/v2/bridge/searchGate?nv_mid=1','https://nid.naver.com/nidlogin.login','https://smartstore.naver.com.evil.test/a/products/1']){
  assert.equal(publicProductUrl(url),null);
  const visit=new URL(shoppingAdVisitUrl({title:'정확한 상품명',url}));assert.equal(visit.hostname,'search.naver.com');assert.equal(visit.searchParams.get('query'),'정확한 상품명');
 }
 assert.equal(shoppingAdVisitUrl({title:'상품',url:product+'?tracking=1'}),product);
});
test('visible purchase badges are retained even when span counters are empty',()=>{
 const [item]=normalizeObservedAds([{ad:true,title:'아이닉',periodText:'구매 1천+\n찜 4,059',purchaseCount:'',wishCount:''}]).items;
 assert.equal(item.purchaseCount,'1천+');assert.equal(item.wishCount,'4,059');
});