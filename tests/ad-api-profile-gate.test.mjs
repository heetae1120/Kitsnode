import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberEligibility} from '../supabase/functions/kitsnode-ad-api/src/member-eligibility.mjs';
import {createMemberEligibility as createConsentEligibility} from '../supabase/functions/kitsnode-ad-consent-api/shared/member-eligibility.mjs';
import {selectRoute} from '../supabase/functions/kitsnode-ad-api/src/select-route.mjs';
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fake(pending,error=null){
 const calls=[];
 const query={select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:id,accepted_at:'2026-01-01T00:00:00Z'},error:null})};
 return {calls,from(){return query},rpc:async(name,args)=>{calls.push({name,args});return {data:pending,error}}};
}
for(const [pending,error,expected] of [[true,null,false],[false,null,true],[null,{code:'unavailable'},false]]){
 test(`profile guard ${pending===null?'error':String(pending)}`,async()=>{const client=fake(pending,error);const gate=createMemberEligibility(client,{termsVersion:'v1',privacyVersion:'v1',requireEmailProfile:true});assert.equal(await gate(id),expected);assert.deepEqual(client.calls,[{name:'kitsnode_email_profile_pending_for_service',args:{p_user:id}}]);});
}
test('default off keeps prior behavior and does not call profile RPC',async()=>{const client=fake(true);const gate=createMemberEligibility(client,{termsVersion:'v1',privacyVersion:'v1'});assert.equal(await gate(id),true);assert.equal(client.calls.length,0)});
test('consent uses its own gate and fails closed only when enabled',async()=>{const client=fake(true);const options={termsVersion:'v1',privacyVersion:'v1'};assert.equal(await createConsentEligibility(client,options)(id),true);assert.equal(client.calls.length,0);assert.equal(await createConsentEligibility(client,{...options,requireEmailProfile:true})(id),false);assert.equal(client.calls.length,1)});
test('performance and shopping routes preserve production selection',()=>{const getApps=()=>{throw Error('unexpected review setup')},getPerformance=()=>({handler:'performance'}),getShopping=()=>({handler:'shopping'});const x={getApps,getPerformance,getShopping,performanceEnabled:true,shoppingEnabled:true,shadowEnabled:true};assert.deepEqual(selectRoute('/performance',x),{path:'/api/performance',handler:'performance'});assert.deepEqual(selectRoute('/shopping-bid-preview',x),{path:'/api/shopping-bid-preview',handler:'shopping'});assert.deepEqual(selectRoute('/shopping-shadow',x),{path:'/api/shopping-shadow',handler:'shopping'});assert.equal(selectRoute('/performance',{...x,performanceEnabled:false}),null)});

import {createShoppingPreviewApp} from '../supabase/functions/kitsnode-ad-api/src/shopping-preview-app.mjs';
import {createPerformanceApp} from '../supabase/functions/kitsnode-ad-api/src/performance-app.mjs';
const origin='https://heetae1120.github.io';
const authClient={auth:{getUser:async()=>({data:{user:{id,aud:'authenticated'}},error:null})}};
for(const enabled of [false,true]) test(`composed production shopping and performance paths with profile gate ${enabled?'on':'off'}`,async()=>{
 const client=fake(true);const calls=[];client.rpc=async(name,args)=>{calls.push(name);if(name==='kits_ads_rate_limit')return {data:true,error:null};if(name==='kitsnode_email_profile_pending_for_service')return {data:true,error:null};if(name==='kits_ads_list')return {data:[],error:null};return {data:null,error:null}};
 const config={authClient,serviceClient:client,allowedOrigins:[origin],apiKey:'fixture',secretKey:'fixture',requireEmailProfile:enabled,fetcher:async()=>{throw Error('unexpected external request')}};
 const shopping=createShoppingPreviewApp(config);
 const request=(path,body)=>new Request(`https://local.test${path}`,{method:'POST',headers:{origin,authorization:'Bearer valid','content-type':'application/json'},body:JSON.stringify(body)});
 const shoppingResponse=await shopping.handler(request('/api/shopping-catalog',{action:'connections'}));
 assert.equal(shoppingResponse.status,enabled?403:200);
 assert.equal(calls.includes('kits_ads_list'),!enabled);
 assert.equal(calls.includes('kitsnode_email_profile_pending_for_service'),enabled);
 calls.length=0;
 const performance=createPerformanceApp(config);
 const performanceResponse=await performance.handler(request('/api/performance',{connectionId:'11111111-1111-4111-8111-111111111111',kind:'product',campaignId:'cmp-1',groupId:'grp-1',targetId:'nad-1',since:'2026-11-01',until:'2026-11-02'}));
 assert.equal(performanceResponse.status,200);
 assert.equal(calls.includes('kitsnode_email_profile_pending_for_service'),enabled);
 if(enabled)assert.equal(calls.includes('kits_ads_get_binding'),false);
});
