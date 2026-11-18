import test from 'node:test';
import assert from 'node:assert/strict';
import {startAutomaticInvite} from './automatic-start.mjs';
import {runAutomaticController} from './automatic-controller.mjs';
const nonce='12345678-1234-4234-8234-123456789abc';
function fixture(){
 const memory={},actions=[];const url='https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited';let active=4,policies=0;
 const chromeApi={tabs:{query:async()=>[{id:active,url}],create:async x=>{actions.push(['tab',x]);}},runtime:{getURL:x=>'chrome-extension://fixture/'+x},
 storage:{session:{set:async obj=>Object.assign(memory,obj),get:async key=>({[key]:memory[key]}),remove:async key=>{delete memory[key]}},local:{get:async()=>({}),set:async()=>actions.push('reserved')}},
 scripting:{executeScript:async({func,args=[]})=>{
  if(func.name==='captureAdvertiser')return [{result:{accountId:'123',viewerId:'advertiser'}}];
  const action=typeof args[0]==='string'?args[0]:args[0]?.action;actions.push(action);
  return [{result:action==='policy'?(++policies===1?'policy_required':'policy_complete'):({open:'opened',policy_inspect:'policy_confirmed',fill:'filled',lookup:'lookup_started',next:'next_started',role:'ready',viewer:'viewer:advertiser',inspect_send:'ready',send:'send_attempted'})[action]}];
 }}};
 const locks={request:async(_key,_options,fn)=>fn({})};return {chromeApi,locks,actions,memory,setActive:v=>{active=v}};
}
test('user approved start binds active tab and never sends during setup',async()=>{
 const f=fixture();assert.equal(await startAutomaticInvite({chromeApi:f.chromeApi,nonce,confirmAction:async()=>true}),'started');
 assert.equal(f.memory['automatic_start_'+nonce].viewerId,'advertiser');assert.equal(f.actions.some(x=>x==='send'),false);
});
test('no approval means no background controller or record',async()=>{
 const f=fixture();assert.equal(await startAutomaticInvite({chromeApi:f.chromeApi,nonce,confirmAction:async()=>false}),'cancelled');assert.deepEqual(f.memory,{});assert.deepEqual(f.actions,[]);
});
test('controller rejects missing or expired bindings',async()=>{
 const f=fixture();assert.equal((await runAutomaticController({chromeApi:f.chromeApi,locks:f.locks,nonce,wait:async()=>{}})).status,'blocked');
 f.memory['automatic_start_'+nonce]={approved:true,tabId:4,createdAt:Date.now()-70000};assert.equal((await runAutomaticController({chromeApi:f.chromeApi,locks:f.locks,nonce,wait:async()=>{}})).status,'blocked');
});
test('one consent and policy review drive the bound tab until an uncertain send result',async()=>{
 const f=fixture();await startAutomaticInvite({chromeApi:f.chromeApi,nonce,confirmAction:async()=>true});
 const r=await runAutomaticController({chromeApi:f.chromeApi,locks:f.locks,nonce,wait:async()=>{}});
 assert.deepEqual(r,{status:'uncertain',retry:'disabled'});assert.equal(f.actions.filter(x=>x==='send').length,1);
 assert.equal((await runAutomaticController({chromeApi:f.chromeApi,locks:f.locks,nonce,wait:async()=>{}})).status,'blocked');
});
test('changing the user tab stops the operation after the policy screen',async()=>{
 const f=fixture();await startAutomaticInvite({chromeApi:f.chromeApi,nonce,confirmAction:async()=>true});
 const r=await runAutomaticController({chromeApi:f.chromeApi,locks:f.locks,nonce,wait:async()=>{f.setActive(9)}});
 assert.equal(r.status,'policy_required');assert.equal(f.actions.includes('send'),false);
});
