import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchShoppingAdSnapshot} from '../src/lib/fetch-shopping-ad-snapshot';
for(const body of ['<html>Gateway error</html>','null'])test(`server error body gets Korean guidance: ${body}`,async()=>{
 const fetcher:typeof fetch=async()=>new Response(body,{status:502});
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher}),/광고 화면을 가져오지 못했어요/);
});
test('HTML rate-limit uses Retry-After rather than JSON parser failure',async()=>{
 let calls=0;const delays:number[]=[];
 const fetcher:typeof fetch=async()=>++calls===1?new Response('<html>busy</html>',{status:429,headers:{'Retry-After':'7'}}):Response.json({reason:'SHOPPING_PAGE_BLOCKED'},{status:502});
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher,wait:async ms=>{delays.push(ms)}}),/서버 접근/);
 assert.equal(calls,2);assert.deepEqual(delays,[7000]);
});
test('malformed success does not become a valid snapshot',async()=>{
 const fetcher:typeof fetch=async()=>new Response('<html>not data</html>');
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher}),/광고 확인 자료/);
});
for(const name of ['AbortError','TimeoutError'])test(`body ${name} is preserved`,async()=>{
 const error=new Error('fixture cancellation');error.name=name;
 const fetcher:typeof fetch=async()=>{const response=Response.json(null);response.json=async()=>{throw error};return response;};
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher}),e=>e===error);
});
for(const header of ['120',new Date(Date.now()+120000).toUTCString()])test(`long Retry-After stops rather than retries early ${header}`,async()=>{
 let calls=0,waits=0;const fetcher:typeof fetch=async()=>{calls++;return new Response('busy',{status:429,headers:{'Retry-After':header}})};
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher,wait:async()=>{waits++}}),/자동 조회를 멈췄습니다/);
 assert.equal(calls,1);assert.equal(waits,0);
});
test('null busy body retains bounded retries',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json(null,{status:429})};
 await assert.rejects(fetchShoppingAdSnapshot('fixture',new AbortController().signal,()=>{},{fetcher,wait:async()=>{}}),/대기가 길어/);
 assert.equal(calls,10);
});
