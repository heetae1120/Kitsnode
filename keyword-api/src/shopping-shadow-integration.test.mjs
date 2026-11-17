import test from 'node:test';import assert from 'node:assert/strict';
import {createShoppingShadowService} from './shopping-shadow-service.mjs';import {shoppingScopeFingerprint} from './shopping-shadow-run.mjs';import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';import {createShoppingPreviewClient} from '../../src/lib/shopping-preview-client.mjs';
const user='11111111-1111-4111-8111-111111111111',connection='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ruleId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',entryId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',origin='https://site.example';
test('client through API saves a rule, records a disabled simulation, and retrieves history',async()=>{
 let saved=null,history=[];const verifier=async token=>token==='a.b.c'?{id:user}:null;
 const store={save:async(_u,r)=>saved={id:ruleId,connection_id:r.connectionId,campaign_id:r.campaignId,adgroup_id:r.adgroupId,target_type:r.targetType,target_id:r.targetId,reference_bid:r.referenceBid,min_bid:r.minBid,max_bid:r.maxBid,max_change:r.maxChange,version:0},list:async()=>saved?[saved]:[],append:async(_u,_id,version,_revision,result)=>{history.push({id:entryId,created_at:'2026-11-17T05:00:00Z',rule_version:version,result});return entryId},history:async()=>history};
 const shadow=createShoppingShadowService({verifySession:verifier,memberAllowed:async()=>true,getBinding:async()=>({userId:user,status:'read_connected',revision:1}),catalog:async()=>({ok:true,items:[{id:'grp-1'}]}),compare:async()=>({status:'observed_consistent',masterCount:1,liveCount:1,liveFingerprint:shoppingScopeFingerprint([{id:'nad-1',useGroupBid:true}])}),preview:async()=>({status:'illustrative',currentBid:50,proposedBid:60,observedProducts:[{id:'nad-1',useGroupBid:true}],blockers:['campaign_inactive']}),store});
 const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession:verifier,allowRequest:async()=>true,preview:async()=>({status:'skipped'}),shadow});
 const client=createShoppingPreviewClient({enabled:true,fetcher:async(url,options)=>{const headers=new Headers(options.headers);headers.set('origin',origin);return handler(new Request('https://api.example/api/shopping-shadow',{...options,headers}))}}),signal=new AbortController().signal;
 const input={action:'save',connectionId:connection,campaignId:'cmp-1',adgroupId:'grp-1',referenceBid:60,minBid:50,maxBid:1000,maxChange:20,expectedVersion:null};
 assert.equal((await client.shadow('a.b.c',input,signal)).rule.id,ruleId);assert.equal((await client.shadow('a.b.c',{action:'list',connectionId:connection},signal)).rules.length,1);
 const result=await client.shadow('a.b.c',{action:'simulate',connectionId:connection,ruleId},signal);assert.equal(result.result.execution,'disabled');assert.equal(result.result.currentBid,50);assert.equal(result.result.proposedBid,60);assert.ok(result.result.blockers.includes('source_completeness_unverified'));
 const entries=await client.shadow('a.b.c',{action:'history',connectionId:connection,ruleId},signal);assert.equal(entries.entries.length,1);assert.equal(entries.entries[0].result.referenceBid,60);
});

test('individual product and keyword rules travel through client and API without execution',async()=>{
 let rules=[],history=[];const verifier=async token=>token==='a.b.c'?{id:user}:null;
 const store={save:async(_u,r)=>{const entry={id:r.targetType==='product'?ruleId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',connection_id:r.connectionId,campaign_id:r.campaignId,adgroup_id:r.adgroupId,target_type:r.targetType,target_id:r.targetId,reference_bid:r.referenceBid,min_bid:r.minBid,max_bid:r.maxBid,max_change:r.maxChange,version:0};rules.push(entry);return entry},list:async()=>rules,append:async(_u,_id,version,_revision,result)=>{history.push({id:entryId,created_at:'2026-11-17T05:00:00Z',rule_version:version,result});return entryId},history:async()=>history};
 const catalog=async(_t,r)=>({ok:true,items:['groups','keywordGroups'].includes(r.action)?[{id:'grp-1',bid:50,status:'PAUSED'}]:r.action==='products'?[{id:'nad-1',bid:null,useGroupBid:true,status:'PAUSED'}]:[{id:'nkw-1',bid:70,useGroupBid:false,status:'ELIGIBLE'}]});
 const shadow=createShoppingShadowService({verifySession:verifier,memberAllowed:async()=>true,getBinding:async()=>({userId:user,status:'read_connected',revision:1}),catalog,compare:async()=>{throw Error('unexpected')},preview:async()=>{throw Error('unexpected')},store});
 const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession:verifier,allowRequest:async()=>true,preview:async()=>({status:'skipped'}),shadow});
 const client=createShoppingPreviewClient({enabled:true,fetcher:async(_url,options)=>{const headers=new Headers(options.headers);headers.set('origin',origin);return handler(new Request('https://api.example/api/shopping-shadow',{...options,headers}))}}),signal=new AbortController().signal;
 for(const [targetType,targetId] of [['product','nad-1'],['keyword','nkw-1']]){
  const input={action:'saveTarget',connectionId:connection,campaignId:'cmp-1',adgroupId:'grp-1',targetType,targetId,referenceBid:100,minBid:50,maxBid:1000,maxChange:20,expectedVersion:null};
  const saved=await client.shadow('a.b.c',input,signal);assert.equal(saved.rule.target_id,targetId);
  const result=await client.shadow('a.b.c',{action:'simulate',connectionId:connection,ruleId:saved.rule.id},signal);assert.equal(result.result.execution,'disabled');assert.ok(result.result.blockers.includes('atomic_update_unavailable'));
 }
 assert.equal((await client.shadow('a.b.c',{action:'list',connectionId:connection},signal)).rules.length,2);
});

test('rank goals are stored per target and used in simulation and history',async()=>{
 let rules=[],history=[];let unavailable=false;const verifier=async token=>token==='a.b.c'?{id:user}:null;
 const store={save:async()=>null,saveRank:async(_u,r)=>{const existing=rules.find(v=>v.target_id===r.targetId);if(existing&&existing.version!==r.expectedVersion)return null;const entry={id:existing?.id||(r.targetType==='product'?ruleId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),connection_id:r.connectionId,campaign_id:r.campaignId,adgroup_id:r.adgroupId,target_type:r.targetType,target_id:r.targetId,reference_bid:r.referenceBid,min_bid:r.minBid,max_bid:r.maxBid,max_change:r.maxChange,pc_position:r.pcPosition,mobile_position:r.mobilePosition,version:existing?existing.version+1:0};rules=rules.filter(v=>v.target_id!==r.targetId);rules.push(entry);return entry},list:async()=>rules,append:async(_u,id,version,_revision,result)=>{history.push({id:entryId,rule_id:id,created_at:'2026-11-17T05:00:00Z',rule_version:version,result});return entryId},history:async(_u,id)=>history.filter(x=>x.rule_id===id)};
 const catalog=async(_t,r)=>({ok:true,items:['groups','keywordGroups'].includes(r.action)?[{id:'grp-1',bid:100,status:'PAUSED'}]:r.action==='products'?[{id:'nad-1',bid:100,useGroupBid:false,status:'ELIGIBLE'}]:[{id:'nkw-1',bid:100,useGroupBid:false,status:'ELIGIBLE'}]});
 const rankEstimate=async(_t,r)=>unavailable?{status:'unavailable',execution:'disabled'}:{status:'comparison_available',execution:'disabled',rankGuaranteed:false,simultaneousRank:'unverified',pc:{position:r.pcPosition,bid:150},mobile:{position:r.mobilePosition,bid:300}};
 const shadow=createShoppingShadowService({verifySession:verifier,memberAllowed:async()=>true,getBinding:async()=>({userId:user,status:'read_connected',revision:1}),catalog,compare:async()=>null,preview:async()=>null,rankEstimate,store});
 const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession:verifier,allowRequest:async()=>true,preview:async()=>({status:'skipped'}),shadow});
 const client=createShoppingPreviewClient({enabled:true,fetcher:async(_url,options)=>{const headers=new Headers(options.headers);headers.set('origin',origin);return handler(new Request('https://api.example/api/shopping-shadow',{...options,headers}))}}),signal=new AbortController().signal;
 for(const [targetType,targetId] of [['product','nad-1'],['keyword','nkw-1']]){
  const input={action:'saveRankTarget',connectionId:connection,campaignId:'cmp-1',adgroupId:'grp-1',targetType,targetId,referenceBid:100,minBid:50,maxBid:200,maxChange:50,expectedVersion:null,pcPosition:1,mobilePosition:2};
  const saved=await client.shadow('a.b.c',input,signal);assert.equal(saved.rule.pc_position,1);assert.equal(saved.rule.mobile_position,2);
  const result=await client.shadow('a.b.c',{action:'simulate',connectionId:connection,ruleId:saved.rule.id},signal);
  assert.equal(result.result.proposedBid,150);assert.equal(result.result.rankEstimate.pc.bid,150);assert.equal(result.result.rankEstimate.mobile.bid,300);assert.ok(result.result.blockers.includes('rank_target_above_cap'));assert.equal(result.result.execution,'disabled');
  const entries=await client.shadow('a.b.c',{action:'history',connectionId:connection,ruleId:saved.rule.id},signal);assert.equal(entries.entries[0].result.rankEstimate.mobile.position,2);
  unavailable=true;const failed=await client.shadow('a.b.c',{action:'simulate',connectionId:connection,ruleId:saved.rule.id},signal);assert.equal(failed.result.proposedBid,null);assert.ok(failed.result.blockers.includes('rank_estimate_unavailable'));unavailable=false;
 }
});
