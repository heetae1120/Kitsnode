import test from 'node:test';import assert from 'node:assert/strict';import {createSharedRateLimiter} from './shared-rate-limit.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('shared limiter only accepts true from server RPC',async()=>{let args;const f=createSharedRateLimiter({rpc:async(n,a)=>{args=[n,a];return{data:true,error:null}}});assert.equal(await f(id),true);assert.deepEqual(args,['kits_ads_rate_limit',{p_user_id:id}]);assert.equal(await f('bad'),false)});
test('RPC error fails closed',async()=>{const f=createSharedRateLimiter({rpc:async()=>({data:null,error:{}})});await assert.rejects(f(id));});
