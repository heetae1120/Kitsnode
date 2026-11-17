import test from 'node:test';import assert from 'node:assert/strict';import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createConnectionService} from './connection-service.mjs';
const user='a0000000-0000-4000-8000-000000000001',op='a0000000-0000-4000-8000-000000000002',rid='a0000000-0000-4000-8000-000000000003';
const row={request_id:rid,user_id:user,ad_account_id:'2647636',status:'pending_review',revision:0};
test('uses caller request ID and DB must return the same ID',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:rid,error:null}}};const store=createSupabaseConnectionStore(db);
 assert.equal(await store.createPending({requestId:rid,userId:user,adAccountId:'2647636'}),true);
 assert.deepEqual(calls,[{name:'kits_ads_request',args:{p_request_id:rid,p_user_id:user,p_ad_account_id:'2647636'}}]);
 const mismatch=createSupabaseConnectionStore({rpc:async()=>({data:op,error:null})});await assert.rejects(()=>mismatch.createPending({requestId:rid,userId:user,adAccountId:'2647636'}));
});
test('list is scoped to server user, strips extra fields and rejects malformed records',async()=>{
 let calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:[{...row,secret:'not returned'}],error:null}}};const store=createSupabaseConnectionStore(db);
 assert.deepEqual(await store.listOwned(user),[{requestId:rid,userId:user,adAccountId:'2647636',status:'pending_review',revision:0}]);assert.equal(calls[0].args.p_user_id,user);
 db.rpc=async()=>({data:[{...row,revision:'9007199254740993'}],error:null});await assert.rejects(()=>store.listOwned(user));
});
test('approval passes verified parameters and preserves compare-and-swap failure',async()=>{
 let args;const store=createSupabaseConnectionStore({rpc:async(name,input)=>{assert.equal(name,'kits_ads_approve');args=input;return {data:false,error:null}}});
 const ok=await store.approvePending({requestId:rid,userId:user,adAccountId:'2647636',expectedRevision:1,customerId:'4563552',naverRole:'MASTER',operatorId:op,evidenceRef:'proof-1'});
 assert.equal(ok,false);assert.equal(args.p_customer_id,'4563552');assert.equal(args.p_revision,1);assert.equal(args.p_operator_id,op);
});
test('fails closed on invalid identity, duplicate claim, and RPC error without leaking error',async()=>{
 const store=createSupabaseConnectionStore({rpc:async()=>({error:{code:'23505',message:'sensitive'},data:null})});
 await assert.rejects(()=>store.createPending({requestId:rid,userId:'not-verified',adAccountId:'2647636'}));assert.equal(await store.createPending({requestId:rid,userId:user,adAccountId:'2647636'}),false);
 const bad=createSupabaseConnectionStore({rpc:async()=>{throw Error('sensitive')}});await assert.rejects(()=>bad.disconnectOwned({userId:user,requestId:rid}),{message:'unavailable'});
});
test('actual connection service wires through pending -> verified operator review -> approval -> disconnect',async()=>{
 let status='pending_review';let calls=[];
 const store=createSupabaseConnectionStore({rpc:async(name,args)=>{calls.push(name);switch(name){case 'kits_ads_request':return {data:rid};case 'kits_ads_review':return {data:[{...row,status}]};case 'kits_ads_approve':status='read_connected';return {data:true};case 'kits_ads_list':return {data:[{...row,status}]};case 'kits_ads_disconnect':status='disconnected';return {data:true};default:throw Error('bad rpc');}}});
 const service=createConnectionService({verifySession:async token=>({id:token==='operator'?op:user}),verifyOperator:async id=>id===op,verifyOwnershipEvidence:async()=>true,resolveAccount:async adAccountId=>({ok:true,adAccountId,customerId:'4563552',role:'MASTER'}),store,createId:()=>rid});
 assert.equal((await service.request('member','2647636')).status,'pending_review');assert.equal((await service.approve('operator',rid,'proof-1')).status,'read_connected');assert.equal((await service.get('member',rid)).status,'read_connected');assert.equal((await service.disconnect('member',rid)).status,'disconnected');
 assert.deepEqual(calls,['kits_ads_request','kits_ads_review','kits_ads_approve','kits_ads_list','kits_ads_disconnect']);
});
