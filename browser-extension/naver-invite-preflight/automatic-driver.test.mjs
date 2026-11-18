import test from 'node:test';
import assert from 'node:assert/strict';
import {runAutomaticInviteInTab} from './automatic-driver.mjs';

function fixture({switchTab=false}={}) {
 const actions=[];let queries=0,policy=0;const url='https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited';
 const responses={open:'opened',fill:'filled',lookup:'lookup_started',next:'next_started',role:'ready'};
 const chromeApi={tabs:{query:async()=>[{id:switchTab&&++queries>2?8:4,url}]},storage:{local:{get:async()=>({}),set:async()=>actions.push('record')}},
 scripting:{executeScript:async({func,args})=>{const action=typeof args[0]==='string'?args[0]:args[0].action;actions.push(action);let result;
  if(func.name==='automaticInviteStep')result=action==='policy'?(++policy===1?'policy_required':'policy_complete'):responses[action];
  else result=action==='viewer'?'viewer:advertiser':action==='inspect_send'?'ready':'send_attempted';
  return [{result}];}}};
 const input={chromeApi,tabId:4,accountId:'123',viewerId:'advertiser',consent:{approved:true,accountId:'123',recipientId:'kitsnode',role:'OPERATIONS_MANAGER'},locks:{request:async(_key,_opts,fn)=>fn({})},waitForPolicy:async()=>true,wait:async()=>{}};
 return {actions,input};
}
test('after the policy review invokes the bound tab and one-shot sender automatically',async()=>{
 const f=fixture();assert.deepEqual(await runAutomaticInviteInTab(f.input),{status:'uncertain',retry:'disabled'});
 assert.deepEqual(f.actions,['open','policy','policy','fill','lookup','next','role','viewer','inspect_send','record','send']);
});
test('changing the active tab blocks further stages and the send',async()=>{
 const f=fixture({switchTab:true});assert.equal((await runAutomaticInviteInTab(f.input)).status,'blocked');assert.equal(f.actions.includes('send'),false);
});
test('wrong consent blocks even opening a dialog',async()=>{
 const f=fixture();f.input.consent.recipientId='other';assert.equal((await runAutomaticInviteInTab(f.input)).status,'blocked');assert.deepEqual(f.actions,[]);
});
