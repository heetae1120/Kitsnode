import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchShoppingAdSnapshot} from '../src/lib/fetch-shopping-ad-snapshot';

test('a busy collector waits and retries automatically instead of ending the lookup',async()=>{
 let calls=0,waiting=0;const delays:number[]=[];
 const fetcher:typeof fetch=async()=>{calls++;return calls===1?Response.json({code:'COLLECTOR_BUSY'},{status:429,headers:{'Retry-After':'5'}}):Response.json({reason:'SHOPPING_PAGE_BLOCKED'},{status:502});};
 await assert.rejects(fetchShoppingAdSnapshot('가습기',new AbortController().signal,()=>waiting++,{fetcher,wait:async ms=>{delays.push(ms);}}),/서버 접근/);
 assert.equal(calls,2);assert.equal(waiting,1);assert.deepEqual(delays,[5000]);
});

test('retries respect the quota wait and stop after a bounded number of requests',async()=>{
 let calls=0;const waits:number[]=[];const fetcher:typeof fetch=async()=>{calls++;return Response.json({retryAfter:60},{status:429});};
 await assert.rejects(fetchShoppingAdSnapshot('가습기',new AbortController().signal,()=>{},{fetcher,wait:async ms=>{waits.push(ms);}}),/대기가 길어/);
 assert.equal(calls,10);assert.ok(waits.every(ms=>ms===60000));
});

test('cancelling during a queue wait does not send another request',async()=>{
 let calls=0;const controller=new AbortController();const fetcher:typeof fetch=async()=>{calls++;return Response.json({code:'COLLECTOR_BUSY'},{status:429});};
 const result=fetchShoppingAdSnapshot('가습기',controller.signal,()=>controller.abort(),{fetcher});
 await assert.rejects(result);assert.equal(calls,1);
});
