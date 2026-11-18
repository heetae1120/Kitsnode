import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduledAccountVerifier,createScheduledShadowApp} from './scheduled-shadow-app.mjs';
import {createScheduledShadowTimer} from './scheduled-shadow-timer.mjs';
const userId='11111111-1111-4111-8111-111111111111',time=Date.parse('2026-11-17T12:15:00Z');
const validUser={id:userId,is_anonymous:false,confirmed_at:'2026-01-01T00:00:00Z',banned_until:null,deleted_at:null};
function clientFor(getUserById){return {rpc:async()=>({data:[],error:null}),from:()=>({}),auth:{admin:{getUserById}}}}
test('active account verification fails closed for banned, anonymous, unconfirmed, deleted, missing or faulty accounts',async()=>{
 for(const user of [{...validUser,is_anonymous:true},{...validUser,is_anonymous:undefined},{...validUser,confirmed_at:null},{...validUser,deleted_at:'2026-01-01'}, {...validUser,banned_until:'2099-01-01'}, {...validUser,banned_until:'bad'},null]){
  const verify=createScheduledAccountVerifier(clientFor(async()=>({data:{user},error:null})),{now:()=>time});assert.equal(await verify(userId),false);
 }
 assert.equal(await createScheduledAccountVerifier(clientFor(async()=>({data:{user:validUser},error:null})),{now:()=>time})(userId),true);
 assert.equal(await createScheduledAccountVerifier(clientFor(async()=>{throw Error('network')}),{now:()=>time})(userId),false);
});
test('worker is default disabled and performs no database reads; explicit enable loads only candidates',async()=>{
 let requests=0;const client=clientFor(async()=>({data:{user:validUser},error:null}));client.rpc=async name=>{requests++;return {data:name==='kits_shadow_schedule_unresolved'?{staleClaimed:0,uncertain:0}:[],error:null}};
 const disabled=createScheduledShadowApp({serviceClient:client,apiKey:'key',secretKey:'secret',now:()=>time});assert.equal((await disabled.run()).status,'disabled');assert.equal(requests,0);
 const enabled=createScheduledShadowApp({serviceClient:client,apiKey:'key',secretKey:'secret',now:()=>time,enabled:true});const result=await enabled.run();assert.equal(result.status,'completed');assert.equal(result.execution,'disabled');assert.equal(requests,2);
});
test('timer needs explicit enable and start, aligns the next tick and stops cleanly',async()=>{
 let clock=time,count=0,scheduled=[],cleared=[];const setTimer=(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length},clearTimer=id=>cleared.push(id);
 const disabled=createScheduledShadowTimer({run:async()=>{count++},now:()=>clock,setTimer,clearTimer});assert.equal(disabled.start(),false);assert.equal(count,0);
 const timer=createScheduledShadowTimer({enabled:true,run:async()=>{count++;return {status:'completed'}},now:()=>clock,setTimer,clearTimer});assert.equal(timer.start(),true);assert.equal(timer.start(),false);await new Promise(resolve=>setImmediate(resolve));assert.equal(count,1);assert.equal(scheduled[0].delay,45*60*1000);
 clock+=45*60*1000;scheduled[0].fn();await new Promise(resolve=>setImmediate(resolve));assert.equal(count,2);assert.equal(scheduled[1].delay,3600000);assert.equal(timer.stop(),true);assert.deepEqual(cleared,[2]);assert.equal(timer.isRunning(),false);
});
test('timer survives failed run and stop during flight does not schedule another tick',async()=>{
 let tasks=[],results=[],release;const run=()=>new Promise(resolve=>{release=resolve});const timer=createScheduledShadowTimer({enabled:true,run,now:()=>time,setTimer:fn=>{tasks.push(fn);return 1},clearTimer:()=>{},onResult:x=>results.push(x)});
 timer.start();timer.stop();release({status:'completed'});await new Promise(resolve=>setImmediate(resolve));assert.equal(tasks.length,0);
 const failing=createScheduledShadowTimer({enabled:true,run:async()=>{throw Error('fail')},now:()=>time,setTimer:fn=>{tasks.push(fn);return 2},clearTimer:()=>{},onResult:x=>results.push(x)});failing.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(results.at(-1).reason,'runner_failed');assert.equal(tasks.length,1);failing.stop();
});
test('scheduled app composes live read adapters and claim-bound simulation without any provider write',async()=>{
 const connectionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ruleId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',claimId='cccccccc-cccc-4ccc-8ccc-cccccccccccc',entryId='dddddddd-dddd-4ddd-8ddd-dddddddddddd',now=Date.now(),slotStartMs=Math.floor(now/3600000)*3600000,schedule={timezone:'Asia/Seoul',slots:'1'.repeat(168)},calls=[],requests=[];
 const ctx={ruleId,ruleVersion:0,connectionId,slotStartMs},state={...ctx,userId,connectionRevision:1,schedule};
 const row={id:ruleId,connection_id:connectionId,campaign_id:'cmp-1',adgroup_id:'grp-1',target_type:'keyword',target_id:'nkw-1',reference_bid:60,min_bid:50,max_bid:1000,max_change:20,version:0,schedule};
 let claimed=false;const c=clientFor(async()=>({data:{user:validUser},error:null}));
 c.from=()=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{user_id:userId,accepted_at:'2026-01-01T00:00:00Z'},error:null})};return chain};
 c.rpc=async(name,args)=>{calls.push(name);let data;
  if(name==='kits_shadow_schedule_candidates')data=[{id:ruleId,version:0,connectionId,schedule}];
  else if(name==='kits_shadow_schedule_unresolved')data={staleClaimed:0,uncertain:0};
  else if(name==='kits_shadow_schedule_check_rule'||name==='kits_shadow_schedule_check')data=state;
  else if(name==='kits_shadow_schedule_claim_v2'){data=claimed?{status:'already_recorded'}:{status:'claimed',claim:{...ctx,claimId}};claimed=true;}
  else if(name==='kits_ads_get_binding')data=[{request_id:connectionId,user_id:userId,status:'read_connected',customer_id:'123',revision:1}];
  else if(name==='kits_shopping_shadow_list')data=[row];
  else if(name==='kits_shadow_schedule_append'){assert.equal(args.p_result.execution,'disabled');assert.equal(args.p_user_id,userId);data=entryId;}
  else if(name==='kits_shadow_schedule_finish')data=true;
  else throw Error(`unexpected ${name}`);
  return {data,error:null};
 };
 const fetcher=async(url,options)=>{requests.push({path:url.pathname,method:options.method});if(url.pathname==='/ncc/adgroups')return Response.json([{nccAdgroupId:'grp-1',nccCampaignId:'cmp-1',customerId:123,adgroupType:'WEB_SITE',bidAmt:50,status:'ELIGIBLE'}]);if(url.pathname==='/ncc/keywords')return Response.json([{nccKeywordId:'nkw-1',nccAdgroupId:'grp-1',customerId:123,keyword:'x',bidAmt:50,useGroupBidAmt:false,status:'ELIGIBLE'}]);throw Error('unexpected provider call')};
 const app=createScheduledShadowApp({serviceClient:c,apiKey:'key',secretKey:'secret',fetcher,enabled:true});const result=await app.run();
 assert.equal(result.counts.recorded,1);assert.equal(result.execution,'disabled');assert.ok(calls.includes('kits_shadow_schedule_append'));assert.ok(requests.length>0);assert.ok(requests.every(x=>x.method==='GET'));
 const second=await app.run();assert.equal(second.counts.duplicate,1);
});
test('hung work times out, reports failure and cannot restart or overlap',async()=>{
 let fire,release,calls=0,events=[],scheduled=0;
 const timer=createScheduledShadowTimer({enabled:true,run:()=>{calls++;return new Promise(resolve=>{release=resolve})},now:()=>time,setTimer:()=>{scheduled++;return 1},clearTimer:()=>{},setWatchdog:fn=>{fire=fn;return 2},clearWatchdog:()=>{},runTimeoutMs:1000,onResult:x=>events.push(x)});
 assert.equal(timer.start(),true);fire();assert.equal(timer.isRunning(),false);assert.equal(events[0].reason,'runner_timeout');assert.equal(timer.start(),false);
 release({status:'completed',counts:{recorded:1}});await new Promise(resolve=>setImmediate(resolve));assert.equal(timer.start(),false);assert.equal(calls,1);assert.equal(scheduled,0);assert.equal(events.length,1);
});
test('a stopped in-flight run cannot be restarted until its promise settles',async()=>{
 let release,calls=0;const timer=createScheduledShadowTimer({enabled:true,run:()=>{calls++;return new Promise(resolve=>{release=resolve})},now:()=>time,setWatchdog:()=>1,clearWatchdog:()=>{},setTimer:()=>1,clearTimer:()=>{}});
 assert.equal(timer.start(),true);assert.equal(timer.stop(),true);assert.equal(timer.start(),false);assert.equal(calls,1);release({status:'completed'});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(timer.start(),true);assert.equal(calls,2);assert.equal(timer.stop(),true);release({status:'completed'});
});
