import test from 'node:test';
import assert from 'node:assert/strict';
import {createShoppingShadowService} from './shopping-shadow-service.mjs';
import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';
import {createShoppingPreviewClient} from '../../src/lib/shopping-preview-client.mjs';
const user='11111111-1111-4111-8111-111111111111',connection='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ruleId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',entryId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',origin='https://example.com';
for(const targetType of ['product','keyword'])test(`${targetType}: client saves weekly slots, runs manual simulation, and reads its schedule history`,async()=>{
 let row={id:ruleId,connection_id:connection,campaign_id:'cmp-1',adgroup_id:'grp-1',target_type:targetType,target_id:targetType==='product'?'nad-1':'nkw-1',reference_bid:60,min_bid:50,max_bid:1000,max_change:20,version:0,schedule:null},entries=[];
 const store={save:async()=>null,list:async()=>[row],saveSchedule:async(_u,input,revision)=>{if(revision!==1||input.expectedVersion!==row.version)return null;row={...row,version:row.version+1,schedule:input.schedule};return row},append:async(_u,_r,version,revision,result)=>{if(version!==row.version||revision!==1)return null;entries.push({id:entryId,rule_version:version,created_at:new Date().toISOString(),result});return entryId},history:async()=>entries};
 const verifySession=async token=>token==='valid'?{id:user}:null;
 const shadow=createShoppingShadowService({verifySession,memberAllowed:async()=>true,getBinding:async()=>({userId:user,status:'read_connected',revision:1}),catalog:async(_t,input)=>({ok:true,items:input.action==='groups'||input.action==='keywordGroups'?[{id:'grp-1',bid:50,status:'ELIGIBLE'}]:[{id:row.target_id,bid:50,status:'ELIGIBLE',useGroupBid:false}]}),compare:async()=>null,preview:async()=>null,store});
 const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession,allowRequest:async()=>true,preview:async()=>null,shadow});
 const client=createShoppingPreviewClient({enabled:true,fetcher:async(_url,options)=>{const headers=new Headers(options.headers);headers.set('origin',origin);return handler(new Request('https://api.example/api/shopping-shadow',{...options,headers}))}}),signal=new AbortController().signal;
 const input={action:'saveSchedule',connectionId:connection,ruleId,expectedVersion:0,schedule:{timezone:'Asia/Seoul',slots:'0'.repeat(168)}};
 const saved=await client.shadow('valid',input,signal);assert.equal(saved.rule.version,1);assert.equal(saved.rule.schedule.slots,input.schedule.slots);
 await assert.rejects(()=>client.shadow('valid',input,signal));
 const simulation=await client.shadow('valid',{action:'simulate',connectionId:connection,ruleId},signal);assert.equal(simulation.result.execution,'disabled');assert.equal(simulation.result.scheduleEvaluation.status,'off');
 const history=await client.shadow('valid',{action:'history',connectionId:connection,ruleId},signal);assert.equal(history.entries[0].result.scheduleEvaluation.status,'off');assert.equal(history.entries[0].rule_version,1);
});
