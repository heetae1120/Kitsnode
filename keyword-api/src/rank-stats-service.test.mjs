import test from 'node:test';
import assert from 'node:assert/strict';
import {createRankStatsService} from './rank-stats-service.mjs';
import {createRankStatsHttp} from './rank-stats-http.mjs';
import {createNaverRankStatsReader} from './naver-rank-stats-read.mjs';

const user='11111111-1111-4111-8111-111111111111',connectionId='22222222-2222-4222-8222-222222222222';
const common={connectionId,kind:'product',campaignId:'cmp-1',groupId:'grp-1',targetId:'nad-1',since:'2026-11-01',until:'2026-11-18'};
const origin='https://example.test';
function setup({rows=[],kind='product'}={}){
 let allowed=true,revision=2,account='123',userOk=true,lookups=[],reads=[];
 const deps={verifySession:async token=>userOk&&token==='valid'?{id:user}:null,memberAllowed:async()=>allowed,getBinding:async()=>({userId:user,status:'read_connected',customerId:account,revision}),
  catalog:async(_token,input)=>{lookups.push(input);return {ok:true,items:[{id:input.action.endsWith('ampaigns')?common.campaignId:input.action.endsWith('roups')?common.groupId:(kind==='product'?'nad-1':'nkw-1')}]};},
  statsForCustomer:id=>createNaverRankStatsReader({apiKey:'fake',secretKey:'fake',customerId:id,now:()=>Date.parse('2026-11-18T01:00:00Z'),fetcher:async(url,opts)=>{reads.push({url,opts});return Response.json({data:rows,compTm:'202611180945',cycleBaseTm:'202611180000'});}})};
 const read=createRankStatsService(deps),handler=createRankStatsHttp({allowedOrigins:[origin],verifySession:deps.verifySession,allowRequest:async()=>true,readStats:read});
 const send=(body={...common},token='valid',requestOrigin=origin)=>handler(new Request('https://local.test/api/rank-stats',{method:'POST',headers:{origin:requestOrigin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {send,read,reads,lookups,revoke:()=>{allowed=false},switchAccount:()=>{account='124';revision++},expire:()=>{userOk=false},deps};
}

test('authorized owner receives data-absent not rank zero, with read-only signed request',async()=>{
 const x=setup();const r=await x.send();assert.equal(r.status,200);const result=(await r.json()).result;assert.equal(result.status,'no_data');assert.equal(result.reason,'empty_response');assert.equal(result.execution,'disabled');assert.equal(result.latency,'provider_data_may_be_delayed');assert.equal(result.targetId,common.targetId);assert.equal(result.customerId,undefined);assert.equal(x.reads.length,1);assert.equal(x.reads[0].opts.method,'GET');assert.equal(x.reads[0].url.origin,'https://api.searchad.naver.com');assert.deepEqual(x.lookups.map(y=>y.action),['campaigns','groups','products']);
});
test('keyword observations are integrated-search averages; zero PC is not zero rank',async()=>{
 const x=setup({kind:'keyword',rows:[{id:'nkw-1',impCnt:10,avgRnk:2,pcNxAvgRnk:0,mblNxAvgRnk:3}]});const r=await x.send({...common,kind:'keyword',targetId:'nkw-1'});const value=(await r.json()).result;assert.equal(value.status,'observed');assert.equal(value.pcIntegratedSearchAverageRank,null);assert.equal(value.mobileIntegratedSearchAverageRank,3);assert.equal(value.deviceMetricScope,'integrated_search_average');assert.equal(value.observedAt,'2026-11-18T01:00:00.000Z');assert.deepEqual(value.sourceTimes,{compTm:'202611180945',cycleBaseTm:'202611180000'});assert.deepEqual(x.lookups.map(y=>y.action),['keywordCampaigns','keywordGroups','keywords']);
});
test('authentication, origin, owner-supplied customer and unrelated target are denied before provider call',async()=>{
 const x=setup();assert.equal((await x.send(common,'bad')).status,401);assert.equal((await x.send(common,'valid','https://evil.test')).status,403);assert.equal((await x.send({...common,customerId:'999'})).status,400);const wrong=await x.read('valid',{...common,targetId:'nad-other'});assert.equal(wrong.reason,'target_unavailable');assert.equal(x.reads.length,0);
});
test('consent revocation, connection switch and session expiration during provider request discard data',async()=>{
 for(const change of ['revoke','switchAccount','expire']){const x=setup();const base=x.deps.statsForCustomer;x.deps.statsForCustomer=id=>{const actual=base(id);return {read:async input=>{const value=await actual.read(input);x[change]();return value}}};const read=createRankStatsService(x.deps);const result=await read('valid',common);assert.equal(result.status,'unavailable');assert.equal(result.reason,change==='switchAccount'?'connection_changed':'unauthorized');}
});
test('invalid dates or malformed provider results fail closed without leaking response contents',async()=>{
 const x=setup();const bad=await x.read('valid',{...common,since:'2026-02-30'});assert.equal(bad.reason,'invalid_input');assert.equal(x.reads.length,0);
 const read=createRankStatsService({...x.deps,statsForCustomer:()=>({read:async()=>({status:'observed',targetId:'nad-1',period:{since:common.since,until:common.until},observedAt:'2026-11-18T01:00:00Z',impressions:10,overallAverageRank:2,pcIntegratedSearchAverageRank:0.5,mobileIntegratedSearchAverageRank:3,secret:'do not expose'})})});const result=await read('valid',common);assert.deepEqual(result,{status:'unavailable',reason:'invalid_response',execution:'disabled'});
});
test('provider observed response with no rank on any surface is rejected',async()=>{
 const x=setup();const read=createRankStatsService({...x.deps,statsForCustomer:()=>({read:async()=>({status:'observed',targetId:'nad-1',period:{since:common.since,until:common.until},observedAt:'2026-11-18T01:00:00Z',impressions:10,overallAverageRank:null,pcIntegratedSearchAverageRank:null,mobileIntegratedSearchAverageRank:null})})});
 assert.deepEqual(await read('valid',common),{status:'unavailable',reason:'invalid_response',execution:'disabled'});
});
