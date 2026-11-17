import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createNaverAdReader} from './naver-ad-read.mjs';
const config={apiKey:'test-key',secretKey:'test-secret',customerId:'123',now:()=>123456789};
test('signs and scopes read-only requests', async()=>{
  const seen=[]; const reader=createNaverAdReader({...config,fetcher:async(u,o)=>{seen.push([u,o]);return Response.json([]);}});
  assert.equal((await reader.campaigns()).ok,true);
  await reader.adgroups('cmp-1'); await reader.keywords('grp-1');
  assert.deepEqual(seen.map(([u])=>u.pathname),['/ncc/campaigns','/ncc/adgroups','/ncc/keywords']);
  for(const [u,o] of seen){assert.equal(o.method,'GET');assert.equal(o.headers['X-Customer'],'123');assert.equal(o.headers['X-Signature'],createHmac('sha256','test-secret').update(`123456789.GET.${u.pathname}`).digest('base64'));}
  assert.equal(seen[2][0].searchParams.get('nccAdgroupId'),'grp-1');
  assert.equal((await reader.keywords('https://evil.test')).code,'invalid_target');assert.equal(seen.length,3);
});
test('denied, malformed and network errors fail closed without leaking response',async()=>{
 for(const [response,code] of [[new Response('secret',{status:403}),'access_denied'],[new Response('bad',{status:200}),'invalid_response']]) {
  const r=createNaverAdReader({...config,fetcher:async()=>response}); assert.deepEqual(await r.campaigns(),{ok:false,code});
 }
 assert.deepEqual(await createNaverAdReader({...config,fetcher:async()=>{throw Error('secret')}}).campaigns(),{ok:false,code:'network_error'});
});
test('rejects oversized response while streaming',async()=>{
 let cancelled=false;const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1_000_001));},cancel(){cancelled=true;}});
 const reader=createNaverAdReader({...config,fetcher:async()=>new Response(body)});
 assert.deepEqual(await reader.campaigns(),{ok:false,code:'invalid_response'});assert.equal(cancelled,true);
});

test('shopping product reads use only the group-scoped GET endpoint',async()=>{
 let request;const reader=createNaverAdReader({apiKey:'key',secretKey:'secret',customerId:'123',now:()=>123456,fetcher:async(url,options)=>{request={url:new URL(url),options};return Response.json([{nccAdId:'nad-1'}]);}});
 const result=await reader.shoppingAds('grp-test-1');assert.equal(result.ok,true);assert.equal(request.url.pathname,'/ncc/ads');assert.equal(request.url.searchParams.get('nccAdgroupId'),'grp-test-1');assert.equal(request.options.method,'GET');assert.equal((await reader.shoppingAds('../bad')).code,'invalid_target');
});
