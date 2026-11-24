import test from 'node:test';
import assert from 'node:assert/strict';
import {AD_CONNECTION_ENDPOINT,createAdConnectionTransport} from '../src/lib/ad-connection-transport.mjs';

test('transport is disabled by default and never sends a request',()=>{
  assert.equal(createAdConnectionTransport(),undefined);
  assert.equal(createAdConnectionTransport({enabled:false}),undefined);
});
test('uses one fixed destination and prevents redirect or ambient credentials',async()=>{
  const seen: Array<{input:RequestInfo|URL; init?:RequestInit}> = [];
  const fetcher: typeof fetch = async (input,init)=>{seen.push({input,init});return Response.json({status:'pending_review'});};
  const transport=createAdConnectionTransport({enabled:true,fetcher})!;
  const signal=new AbortController().signal;
  assert.deepEqual(await transport.request('a.b.c','2647636',signal),{status:'pending_review'});
  assert.equal(seen[0].input,AD_CONNECTION_ENDPOINT);
  assert.equal(seen[0].init?.redirect,'error');assert.equal(seen[0].init?.credentials,'omit');assert.equal(seen[0].init?.cache,'no-store');
  assert.deepEqual(JSON.parse(String(seen[0].init?.body)),{adAccountId:'2647636'});
});
test('validates ownership-independent response shape and only accepts pending result',async()=>{
  const signal=new AbortController().signal;
  const transport=createAdConnectionTransport({enabled:true,fetcher:async()=>Response.json({connections:[{requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',adAccountId:'123',status:'read_connected',customerId:'secret'}]})})!;
  assert.deepEqual(await transport.list('valid.token',signal),{connections:[{requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',adAccountId:'123',status:'read_connected'}]});
  await assert.rejects(transport.request('token','123',signal));
  const bad=createAdConnectionTransport({enabled:true,fetcher:async()=>Response.json({connections:[{adAccountId:'123',status:'invented'}]})})!;
  await assert.rejects(bad.list('token',signal));
});
test('invalid inputs and aborted requests are not sent',async()=>{
  let count=0;const transport=createAdConnectionTransport({enabled:true,fetcher:async()=>{count++;return Response.json({});}})!;
  const controller=new AbortController();controller.abort();
  await assert.rejects(transport.request('token','123',controller.signal));
  await assert.rejects(transport.request('token','12/3',new AbortController().signal));
  assert.equal(count,0);
});
test('distinguishes explicit rejections from an uncertain server failure',async()=>{
  const signal=new AbortController().signal;
  for(const [status,code] of [[401,'session_expired'],[403,'request_forbidden'],[409,'request_conflict'],[429,'rate_limited'],[503,'connection_unavailable']] as const){
    const transport=createAdConnectionTransport({enabled:true,fetcher:async()=>new Response(null,{status})})!;
    await assert.rejects(transport.request('token','123',signal),new RegExp(code));
  }
});
test('late response after cancellation is discarded',async()=>{
  const controller=new AbortController();
  const transport=createAdConnectionTransport({enabled:true,fetcher:async()=>{controller.abort();return Response.json({status:'pending_review'});}})!;
  await assert.rejects(transport.request('token','123',controller.signal),/request_cancelled/);
});

test('disconnect sends a validated request ID to the fixed endpoint and verifies the result',async()=>{
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const seen: Array<{input:RequestInfo|URL;init?:RequestInit}>=[];
  const transport=createAdConnectionTransport({enabled:true,fetcher:async(input,init)=>{seen.push({input,init});return Response.json({status:'disconnected'});}})!;
  const signal=new AbortController().signal;
  assert.deepEqual(await transport.disconnect('valid.token',id,signal),{status:'disconnected'});
  assert.equal(seen[0].input,`${AD_CONNECTION_ENDPOINT}/${id}`);
  assert.equal(seen[0].init?.method,'DELETE');
  assert.equal(seen[0].init?.redirect,'error');
  await assert.rejects(transport.disconnect('valid.token','../other',signal));
  assert.equal(seen.length,1);
  const bad=createAdConnectionTransport({enabled:true,fetcher:async()=>Response.json({status:'pending_review'})})!;
  await assert.rejects(bad.disconnect('valid.token',id,signal));
});
