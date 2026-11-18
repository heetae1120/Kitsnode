import test from 'node:test';import assert from 'node:assert/strict';
import {createShadowClaimReviewApp} from './shadow-claim-review-app.mjs';
const operator='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',claimId='33333333-3333-4333-8333-333333333333',origin='https://example.test';
function setup({user={id:operator,aud:'authenticated',is_anonymous:false},data=true,rate=true}={}){
 const calls=[];const authClient={auth:{getUser:async token=>token==='valid'?{data:{user},error:null}:{error:true}}};
 const serviceClient={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='kits_shadow_claim_review_queue'?[]:data,error:null}}};
 const app=createShadowClaimReviewApp({authClient,serviceClient,operatorIds:operator,origin,allowRequest:async()=>rate});
 const request=(body,token='valid')=>new Request(origin+'/api/shadow-claim-reviews',{method:'POST',headers:{origin,'authorization':'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 return {app,calls,request};
}
const record={action:'record',claimId,expectedState:'uncertain',caseRef:'CASE-123',confirmed:true,acknowledgesMayStillComplete:true};
test('valid operator records server-verified identity, case, and expected state without mutating a claim',async()=>{
 const x=setup(),r=await x.app.handler(x.request(record));assert.equal(r.status,201);assert.deepEqual(await r.json(),{status:'review_recorded',claimStateChanged:false,retried:false,alarmCleared:false});
 assert.deepEqual(x.calls,[{name:'kits_shadow_claim_review_record',args:{p_claim_id:claimId,p_expected_state:'uncertain',p_operator_id:operator,p_case_ref:'CASE-123'}}]);
});
test('invalid JWT, unlisted operator, anonymous user and spoofed identity are denied before DB',async()=>{
 const bad=setup();assert.equal((await bad.app.handler(bad.request(record,'invalid'))).status,401);assert.equal(bad.calls.length,0);
 for(const user of [{id:other,aud:'authenticated',is_anonymous:false},{id:operator,aud:'authenticated',is_anonymous:true}]){const x=setup({user});assert.ok([401,403].includes((await x.app.handler(x.request(record))).status));assert.equal(x.calls.length,0)}
 const x=setup();assert.equal((await x.app.handler(x.request({...record,operatorId:other}))).status,400);assert.equal(x.calls.length,0);
});
test('state race and repeat review are conflicts; failure does not claim cancellation or retry',async()=>{
 const x=setup({data:false});const r=await x.app.handler(x.request(record));assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:'conflict'});
});
test('queue is operator-only, invalid case references and missing confirmation are denied',async()=>{
 const x=setup();assert.equal((await x.app.handler(x.request({action:'queue'}))).status,200);
 for(const body of [{...record,caseRef:'private content'}, {...record,confirmed:false}, {...record,acknowledgesMayStillComplete:false}, {...record,expectedState:'recorded'}])assert.equal((await x.app.handler(x.request(body))).status,400);
 assert.equal(x.calls.length,1);
});
