import test from 'node:test';
import assert from 'node:assert/strict';
import {createDualDeviceEstimateService} from './dual-device-estimate-service.mjs';
import {createNaverRankEstimate} from './naver-rank-estimate.mjs';
import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';
import {createShoppingPreviewClient} from '../../src/lib/shopping-preview-client.mjs';
const user='11111111-1111-4111-8111-111111111111',connection='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',origin='https://example.com',now=1794890000000;
test('client through authenticated HTTP retrieves both estimates without a write path',async()=>{
 const calls=[];
 const rankEstimate=createDualDeviceEstimateService({verifySession:async()=>({id:user}),memberAllowed:async()=>true,getBinding:async()=>({userId:user,customerId:'123',revision:1,status:'read_connected'}),catalog:async(_token,input)=>({ok:true,items:[{id:input.action==='keywordCampaigns'?'cmp-1':input.action==='keywordGroups'?'grp-1':'nkw-1'}]}),estimateForCustomer:customerId=>createNaverRankEstimate({apiKey:'key',secretKey:'secret',customerId,now:()=>now,fetcher:async(url,opts)=>{calls.push({url,opts});const {device,items:[{key,position}]}=JSON.parse(opts.body);return Response.json({device,estimate:[{nccKeywordId:key,position,bid:device==='PC'?150:210}]})}}),now:()=>now});
 const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession:async()=>({id:user}),allowRequest:async()=>true,preview:async()=>({status:'skipped'}),rankEstimate});
 const client=createShoppingPreviewClient({enabled:true,fetcher:async(_url,options)=>{const headers=new Headers(options.headers);headers.set('origin',origin);return handler(new Request('https://api.example/api/shopping-rank-estimate',{...options,headers}))}});
 const result=await client.rankEstimate('member',{connectionId:connection,kind:'keyword',campaignId:'cmp-1',groupId:'grp-1',targetId:'nkw-1',pcPosition:1,mobilePosition:2,maxBid:200},new AbortController().signal);
 assert.equal(result.pc.bid,150);assert.equal(result.mobile.bid,210);assert.equal(result.mobile.withinCap,false);assert.equal(result.execution,'disabled');assert.equal(result.rankGuaranteed,false);assert.equal(calls.length,2);assert.ok(calls.every(x=>x.opts.method==='POST'&&x.url.pathname==='/estimate/average-position-bid/id'));
});
