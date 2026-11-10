import test from 'node:test';
import assert from 'node:assert/strict';
import {createShoppingAdsHandler} from '../keyword-api/src/shopping-ads-handler.mjs';
const request=(keyword='가습기',origin='https://heetae1120.github.io')=>new Request(`https://test.local/api/shopping-ads?keyword=${encodeURIComponent(keyword)}`,{headers:{origin}});
test('failed browser collection reports unavailable, never empty ads or organic rankings',async()=>{
 const handle=createShoppingAdsHandler({fetcher:async()=>{throw Error('must not fetch');},browserCollector:async()=>{throw Error('blocked');}});
 assert.equal((await handle(request(),{})).status,502);
 assert.equal((await handle(request(''),{})).status,400);
 assert.equal((await handle(request('가습기','https://evil.test'),{})).status,403);
});
test('collector keys stay server-side and observation time is not replaced by request time',async()=>{
 const handle=createShoppingAdsHandler({fetcher:async(url:URL|RequestInfo,options?:RequestInit)=>{
  assert.equal(String(url),'https://collector.example/ads');assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer server-secret');
  assert.deepEqual(JSON.parse(options?.body as string),{keyword:'가습기',device:'PC',limit:3});
  return Response.json({keyword:'가습기',device:'PC',observedAt:'2026-11-04T01:00:00Z',items:[],debug:'server-secret'});
 }});
 const response=await handle(request(),{SHOPPING_ADS_COLLECTOR_URL:'https://collector.example/ads',SHOPPING_ADS_COLLECTOR_TOKEN:'server-secret'});
 assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('2026-11-04T01:00:00Z'));assert.ok(!text.includes('server-secret'));
});
test('collector failures and oversized responses are unavailable rather than zero ads',async()=>{
 for(const fetcher of [async()=>new Response('',{status:418}),async()=>new Response('x'.repeat(70000)),async()=>{throw Error('private diagnostic');}]){
  const response=await createShoppingAdsHandler({fetcher})(request(),{SHOPPING_ADS_COLLECTOR_URL:'https://collector.example/ads'});
  assert.equal(response.status,502);assert.ok(!(await response.text()).includes('private diagnostic'));
 }
});

 test('integrated shopping placement is explicit and invalid sources never reach the browser',async()=>{
 let calls=0;let seen:any;
 const handle=createShoppingAdsHandler({browserCollector:async(keyword:string,options:any)=>{calls++;seen=options;return {keyword,device:'PC',placement:'integrated',sourceUrl:'https://search.naver.com/search.naver?query=test',observedAt:new Date().toISOString(),context:'integrated',complete:false,items:[]};}});
 const request=(placement:string)=>new Request('https://example.com/api/shopping-ads?keyword=test&placement='+placement);
 const result=await handle(request('integrated'),{});assert.equal(result.status,200);assert.equal((await result.json()).placement,'integrated');assert.equal(seen.placement,'integrated');
 assert.equal((await handle(request('other'),{})).status,400);assert.equal(calls,1);
 });


test('same-key requests share work and successful captures keep the observed timestamp for one minute',async()=>{
 let calls=0;let release!:()=>void;let clock=0;
 const gate=new Promise<void>(resolve=>release=resolve);
 const handle=createShoppingAdsHandler({maxRequests:1,now:()=>clock,browserCollector:async(keyword:string)=>{calls++;await gate;return {keyword,device:'PC',sourceUrl:'source',observedAt:'original-time',context:'context',complete:false,items:[]};}});
 const first=handle(request(),{});const duplicate=handle(request(),{});
 const busy=await handle(request('다른검색어'),{},'other-client');assert.equal(busy.status,429);assert.equal((await busy.json()).code,'COLLECTOR_BUSY');assert.equal(busy.headers.get('Retry-After'),'5');
 release();const results=await Promise.all([first,duplicate]);assert.deepEqual(await results[0].json(),await results[1].json());assert.equal(calls,1);
 assert.equal((await (await handle(request(),{})).json()).observedAt,'original-time');assert.equal(calls,1);
 clock=61000;assert.equal((await handle(request(),{})).status,200);assert.equal(calls,2);
});

test('failed shared requests release capacity and never enter the success cache',async()=>{
 let calls=0;const handle=createShoppingAdsHandler({browserCollector:async()=>{calls++;throw Error('BROWSER_START_FAILED');}});
 assert.equal((await (await handle(request(),{})).json()).reason,'BROWSER_START_FAILED');
 assert.equal((await handle(request(),{})).status,502);assert.equal(calls,2);
});

