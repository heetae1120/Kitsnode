import test from 'node:test';
import assert from 'node:assert/strict';
import {readAdCounters,readPeriodSales} from '../keyword-api/src/integrated-ad-details.mjs';
import {validateShoppingAdSnapshot} from '../src/lib/shopping-ad-snapshot';
import {encodeDiagnoses,decodeDiagnoses} from '../src/lib/diagnosis-storage';
test('purchase and wishlist counters preserve abbreviated and lower-bound units without inventing a period',()=>{
 assert.deepEqual(readAdCounters('구매 1,633\n찜 1.3만'),{purchaseCount:'1,633',wishCount:'1.3만'});
 assert.equal(readAdCounters('4,270명 이상 구매').purchaseCount,'4,270명 이상');
 assert.deepEqual(readPeriodSales('구매 1,633\n4,270명 이상 구매'),{dailySales:null,weeklySales:null});
 assert.equal(readAdCounters('상품 3개 구매 시 할인').purchaseCount,'');
});
test('saved report evidence keeps counters without retaining temporary ad tracking links or images',async()=>{
 const snapshot=validateShoppingAdSnapshot({keyword:'가습기',device:'PC',placement:'integrated',context:'네이버 통합검색',sourceUrl:'https://search.naver.com/search.naver?query=가습기',observedAt:new Date().toISOString(),complete:false,items:[{rank:1,ad:true,title:'상품',mall:'',price:null,image:'https://shopping-phinf.pstatic.net/example.jpg',url:'https://ader.naver.com/tracking',wishCount:'2,267',purchaseCount:'1,633',reviewCount:'50',rating:4.9}]},'가습기');
 const report={version:1 as const,id:'saved',createdAt:new Date().toISOString(),name:'가습기',months:2,quantity:100,sales:1000,costs:500,profit:500,margin:5,marketing:500,breakEven:100,priority:'확인',action:'비용 확인',examples:false,analysis:{ads:{status:'ready' as const,keyword:'가습기',snapshot}}};
 const [saved]=await decodeDiagnoses(await encodeDiagnoses([report]));const item=saved.analysis!.ads!.snapshot!.items[0];
 assert.equal(item.url,undefined);assert.equal(item.image,null);assert.equal(item.purchaseCount,'1,633');assert.equal(item.wishCount,'2,267');assert.equal(item.rating,4.9);
});
test('landing URLs accept only credential-free HTTPS Naver hosts',()=>{
 const row={rank:1,ad:true,title:'상품',mall:'',price:null,image:null,purchaseCount:'1,633',wishCount:'2,267'};
 const data={keyword:'가습기',device:'PC',placement:'integrated',context:'네이버 통합검색',sourceUrl:'https://search.naver.com/search.naver?query=가습기',observedAt:new Date().toISOString(),complete:false};
 for(const url of ['javascript:alert(1)','https://naver.com.evil.test/','https://user:pass@smartstore.naver.com/a','http://smartstore.naver.com/a'])assert.equal(validateShoppingAdSnapshot({...data,items:[{...row,url}]},'가습기').items[0].url,null);
 const valid='https://smartstore.naver.com/main/products/13771475773';const item=validateShoppingAdSnapshot({...data,items:[{...row,url:valid}]},'가습기').items[0];
 assert.equal(item.url,valid);assert.equal(item.purchaseCount,'1,633');assert.equal(item.wishCount,'2,267');
});
