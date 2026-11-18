import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHmac} from 'node:crypto';
import {createNaverRankStatsReader} from './naver-rank-stats-read.mjs';

const request={targetId:'nkw-test',since:'2026-11-01',until:'2026-11-18'};
const time=Date.parse('2026-11-18T01:00:00Z');
const client=fetcher=>createNaverRankStatsReader({apiKey:'key',secretKey:'secret',customerId:'123',now:()=>time,fetcher});
const response=(data,extra={})=>Response.json({data,compTm:'202611180945',cycleBaseTm:'202611180000',...extra});

test('GET signed request to fixed provider with one target and bounded period',async()=>{
 let called=0;
 const r=await client(async(url,init)=>{called++;assert.equal(url.origin,'https://api.searchad.naver.com');assert.equal(url.pathname,'/stats');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(url.searchParams.get('ids'),'nkw-test');assert.deepEqual(JSON.parse(url.searchParams.get('timeRange')),{since:request.since,until:request.until});assert.deepEqual(JSON.parse(url.searchParams.get('fields')),['impCnt','avgRnk','pcNxAvgRnk','mblNxAvgRnk']);assert.equal(init.headers['X-Customer'],'123');assert.equal(init.headers['X-Signature'],createHmac('sha256','secret').update(`${time}.GET./stats`).digest('base64'));return response([{id:'nkw-test',impCnt:8,avgRnk:2.5,pcNxAvgRnk:2,mblNxAvgRnk:3}]);}).read(request);
 assert.equal(called,1);assert.deepEqual(r,{targetId:'nkw-test',period:{since:request.since,until:request.until},observedAt:'2026-11-18T01:00:00.000Z',sourceTimes:{compTm:'202611180945',cycleBaseTm:'202611180000'},deviceMetricScope:'integrated_search_average',overallMetricScope:'provider_average_rank',source:'naver_stats',status:'observed',impressions:8,overallAverageRank:2.5,pcIntegratedSearchAverageRank:2,mobileIntegratedSearchAverageRank:3});
});
test('empty and zero impressions are missing data rather than rank zero',async()=>{
 const empty=await client(async()=>response([])).read(request);assert.equal(empty.status,'no_data');assert.equal(empty.reason,'empty_response');
 const none=await client(async()=>response([{id:'nkw-test',impCnt:0,avgRnk:0,pcNxAvgRnk:0,mblNxAvgRnk:0}])).read(request);assert.equal(none.status,'no_data');assert.equal(none.reason,'no_impressions');assert.equal(none.pcIntegratedSearchAverageRank,undefined);
 const partial=await client(async()=>response([{id:'nkw-test',impCnt:1,avgRnk:3,pcNxAvgRnk:0,mblNxAvgRnk:2}])).read(request);assert.equal(partial.pcIntegratedSearchAverageRank,null);assert.equal(partial.mobileIntegratedSearchAverageRank,2);
});
test('ranks outside one through 1000 are never presented as valid ranks',async()=>{
 const invalid=await client(async()=>response([{id:'nkw-test',impCnt:1,avgRnk:0.5,pcNxAvgRnk:1000.1,mblNxAvgRnk:-1}])).read(request);
 assert.equal(invalid.status,'no_data');assert.equal(invalid.reason,'rank_unavailable');
 const limits=await client(async()=>response([{id:'nkw-test',impCnt:1,avgRnk:1.5,pcNxAvgRnk:1,mblNxAvgRnk:1000}])).read(request);
 assert.equal(limits.status,'observed');assert.equal(limits.pcIntegratedSearchAverageRank,1);assert.equal(limits.mobileIntegratedSearchAverageRank,1000);
});
test('invalid input, unexpected row target, ambiguous rows and missing impression count fail closed',async()=>{
 let calls=0;const api=client(async()=>{calls++;return response([])});
 for(const bad of [{...request,targetId:'https://evil.invalid'},{...request,since:'2026-02-30'},{...request,since:'2026-10-01'},{...request,since:'2026-11-19'}])assert.equal((await api.read(bad)).reason,'invalid_input');assert.equal(calls,0);
 for(const rows of [[{id:'nkw-other',impCnt:5,avgRnk:1}],[{id:'nkw-test',avgRnk:1}],[{id:'nkw-test',impCnt:1},{id:'nkw-test',impCnt:2}]])assert.equal((await client(async()=>response(rows)).read(request)).reason,'invalid_response');
});
test('network, unauthorized and malformed response do not become empty results',async()=>{
 assert.equal((await client(async()=>{throw Error('secret')}).read(request)).reason,'network_error');
 assert.equal((await client(async()=>new Response('',{status:403})).read(request)).reason,'access_denied');
 assert.equal((await client(async()=>new Response('not json')).read(request)).reason,'invalid_response');
});
test('loopback fake provider returns empty real HTTP response without leaking arbitrary content',async t=>{
 const server=http.createServer((req,res)=>{assert.equal(req.method,'GET');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[],compTm:'202611180945',cycleBaseTm:'202611180000'}))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const port=server.address().port;
 const reader=client((url,init)=>fetch(new URL(url.pathname+url.search,`http://127.0.0.1:${port}`),init));
 assert.equal((await reader.read(request)).status,'no_data');
});
