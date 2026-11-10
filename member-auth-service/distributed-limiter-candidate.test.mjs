import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StrictSiteLimiterCandidate,checkStrictSiteLimit} from './distributed-limiter-candidate.mjs';
function storage(){
 let value,tail=Promise.resolve();return {transaction(callback){const work=tail.then(()=>callback({get:async()=>value,put:async(_k,v)=>{value=structuredClone(v)}}));tail=work.catch(()=>{});return work;},reset(){value=undefined;}};
}
const req=()=>new Request('https://internal.invalid/admit',{method:'POST'});
test('concurrent requests across simulated regions share one strict persisted quota',async()=>{
 const backing=storage(),state={storage:backing},env={STRICT_SITE_LIMIT:'7',STRICT_SITE_WINDOW_SECONDS:'60'};
 const object=new StrictSiteLimiterCandidate(state,env);
 const decisions=await Promise.all(Array.from({length:100},()=>object.fetch(req()).then(r=>r.json())));
 assert.equal(decisions.filter(x=>x.allowed===true).length,7);assert.equal(decisions.filter(x=>x.allowed===false).length,93);
 const rehydrated=new StrictSiteLimiterCandidate(state,env);
 assert.equal((await (await rehydrated.fetch(req())).json()).allowed,false);
 assert.equal((await new StrictSiteLimiterCandidate(state,{...env,STRICT_SITE_LIMIT:'8'}).fetch(req())).status,503);
});
test('missing policy and unexpected routes fail closed',async()=>{
 const object=new StrictSiteLimiterCandidate({storage:storage()},{});
 assert.equal((await object.fetch(req())).status,503);
 assert.equal((await object.fetch(new Request('https://internal.invalid/admit'))).status,404);
});
test('binding errors and timeout fail closed without invoking an alternate bucket',async()=>{
 await assert.rejects(checkStrictSiteLimit(null),/unavailable/);
 const make=fetch=>({idFromName:()=>1,get:()=>({fetch})});
 assert.equal(await checkStrictSiteLimit(make(async()=>Response.json({allowed:false}))),false);
 await assert.rejects(checkStrictSiteLimit(make(async()=>Response.json({invalid:true}))),/Invalid/);
 await assert.rejects(checkStrictSiteLimit(make(()=>new Promise(()=>{})),{timeoutMs:5}),/timed out/);
 await assert.rejects(checkStrictSiteLimit(make(async()=>({ok:true,json:()=>new Promise(()=>{})})),{timeoutMs:5}),/timed out/);
});
