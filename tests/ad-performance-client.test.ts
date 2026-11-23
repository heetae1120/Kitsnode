import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdPerformanceClient} from '../src/lib/ad-performance-client.mjs';
const body={connectionId:'11111111-1111-4111-8111-111111111111',kind:'product' as const,campaignId:'cmp-123',groupId:'grp-123',targetId:'nad-123',since:'2026-11-01',until:'2026-11-18'};
test('disabled by default and sends authorized scoped request only to fixed endpoint',async()=>{
 assert.equal(createAdPerformanceClient(),undefined);
 let url='',options:RequestInit={};
 const fetcher=async (input:RequestInfo|URL,init?:RequestInit)=>{url=String(input);options=init??{};return new Response(JSON.stringify({result:{status:'no_data',reason:'empty_response',targetId:body.targetId,period:{since:body.since,until:body.until},source:'naver_stats'}}),{status:200});};
 const c=createAdPerformanceClient({enabled:true,fetcher})!;await c.read('abc.def.ghi',body,new AbortController().signal);
 assert.match(url,/^https:\/\/bjpguxwqxlsteektkhwf\.supabase\.co\/functions\/v1\/kitsnode-ad-api\/performance$/);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(String(options.body)),body);
});
test('rejects invalid requests and responses for a different target',async()=>{
 const c=createAdPerformanceClient({enabled:true,fetcher:async()=>new Response(JSON.stringify({result:{status:'observed',targetId:'nad-other',period:{since:body.since,until:body.until},source:'naver_stats'}}))})!;
 await assert.rejects(c.read('abc',body,new AbortController().signal));await assert.rejects(c.read('abc',{...body,until:'2026-02-30'},new AbortController().signal));
});
test('hourly requests bind a single day and reject mismatched or malformed rows',async()=>{
 const one={...body,since:'2026-11-18',until:'2026-11-18'};let called='';
 const row={hour:18,impressions:64,clicks:5,cost:2419,purchases:1,revenue:28500,averageCpc:483.8};
 const client=createAdPerformanceClient({enabled:true,fetcher:async(input)=>{called=String(input);return Response.json({result:{status:'observed',targetId:one.targetId,day:one.since,source:'naver_stats',hours:[row]}})}})!;
 const result=await client.readHourly('abc.def',one,new AbortController().signal);assert.equal(result.status,'observed');assert.match(called,/performance-hourly$/);
 await assert.rejects(client.readHourly('abc.def',{...one,until:'2026-11-19'},new AbortController().signal));
 const malformed=createAdPerformanceClient({enabled:true,fetcher:async()=>Response.json({result:{status:'observed',targetId:one.targetId,day:one.since,source:'naver_stats',hours:[row,row]}})})!;
 await assert.rejects(malformed.readHourly('abc.def',one,new AbortController().signal));
});
