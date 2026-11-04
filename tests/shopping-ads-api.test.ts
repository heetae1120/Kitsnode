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
