import test from 'node:test';
import assert from 'node:assert/strict';
import {createShoppingShadowService} from './shopping-shadow-service.mjs';
import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';
const user='11111111-1111-4111-8111-111111111111',connection='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ruleId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',entryId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const schedule={timezone:'Asia/Seoul',slots:'1'.repeat(168)};
const input={action:'saveSchedule',connectionId:connection,ruleId,expectedVersion:0,schedule};
function setup({invalidSession=false,revokeDuringRequest=false,revision=1}={}){
 let saves=0,verifyCount=0,entries=[];
 let row={id:ruleId,connection_id:connection,campaign_id:'cmp-1',adgroup_id:'grp-1',target_type:'product',target_id:'nad-1',reference_bid:60,min_bid:50,max_bid:1000,max_change:20,version:0,schedule:null};
 const verifier=async()=>{verifyCount++;return invalidSession||(revokeDuringRequest&&verifyCount>1)?null:{id:user}};
 const store={save:async()=>null,list:async()=>[row],history:async()=>entries,append:async(_u,_rule,version,_revision,result)=>{entries.push({id:entryId,rule_version:version,created_at:new Date().toISOString(),result});return entryId},saveSchedule:async(_user,request,currentRevision)=>{saves++;if(request.expectedVersion!==row.version||currentRevision!==1)return null;row={...row,schedule:request.schedule,version:row.version+1};return row}};
 const service=createShoppingShadowService({verifySession:verifier,memberAllowed:async()=>true,getBinding:async()=>({userId:user,status:'read_connected',revision}),catalog:async(_t,r)=>({ok:true,items:r.action==='groups'?[{id:'grp-1',status:'ELIGIBLE',bid:50}]:[{id:'nad-1',status:'ELIGIBLE',bid:50,useGroupBid:false}]}),compare:async()=>null,preview:async()=>null,store});
 return {service,saves:()=>saves,entries:()=>entries,verifier};
}
test('schedule saves after session and ownership binding; stale versions and revisions fail',async()=>{
 const x=setup();const result=await x.service('token',input);assert.equal(result.ok,true);assert.deepEqual(result.rule.schedule,schedule);assert.equal(result.rule.version,1);
 assert.equal((await x.service('token',input)).reason,'conflict');const y=setup({revision:2});assert.equal((await y.service('token',input)).reason,'conflict');
});
test('invalid schedule, input and sessions never reach store',async()=>{
 const x=setup();for(const bad of [null,{},[],{...schedule,timezone:'UTC'},{...schedule,slots:'1'.repeat(167)},{...schedule,slots:'x'.repeat(168)},{...schedule,extra:true}])assert.equal((await x.service('token',{...input,schedule:bad})).reason,'invalid_input');
 assert.equal((await x.service('token',{...input,expectedVersion:null})).reason,'invalid_input');assert.equal(x.saves(),0);
 for(const opts of [{invalidSession:true},{revokeDuringRequest:true}]){const y=setup(opts);assert.equal((await y.service('token',input)).reason,'unauthorized');assert.equal(y.saves(),0)}
});
test('manual simulation records the Seoul schedule at simulation start in disabled history, even when off',async()=>{
 const x=setup();await x.service('token',{...input,schedule:{...schedule,slots:'0'.repeat(168)}});const result=await x.service('token',{action:'simulate',connectionId:connection,ruleId});
 assert.equal(result.ok,true);assert.equal(result.result.execution,'disabled');assert.equal(result.result.scheduleEvaluation.status,'off');assert.equal(result.result.scheduleEvaluation.timezone,'Asia/Seoul');assert.ok(Number.isFinite(Date.parse(result.result.scheduleEvaluation.evaluatedAt)));
 const history=await x.service('token',{action:'history',connectionId:connection,ruleId});assert.deepEqual(history.entries[0].result.scheduleEvaluation,result.result.scheduleEvaluation);
});
test('HTTP rejects extra fields and handles 168 schedule bits within the body limit',async()=>{
 const x=setup();const origin='https://example.com';const handler=createShoppingPreviewHttp({allowedOrigins:[origin],verifySession:x.verifier,allowRequest:async()=>true,preview:async()=>null,shadow:x.service});
 const request=body=>new Request('https://example.com/api/shopping-shadow',{method:'POST',headers:{origin,authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handler(request({...input,enabled:true}))).status,400);const response=await handler(request(input));assert.equal(response.status,200);assert.equal((await response.json()).rule.schedule.slots.length,168);
});
