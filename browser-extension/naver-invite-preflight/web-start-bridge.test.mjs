import test from 'node:test';
import assert from 'node:assert/strict';
import {openAdvertiserLogin,bindSelectedAccount,getBoundAdvertiserTab,routeSelectedAdvertiserTab} from './web-start-bridge.mjs';
import {startAdvertiserLogin} from '../../src/lib/naver-invite-extension.mjs';
import {registerWebStartWorker,advanceAdvertiserTab} from './web-start-worker.mjs';

const nonce='11111111-1111-4111-8111-111111111111', page='https://heetae1120.github.io/Kitsnode/store/ads/connect/';
const sender={frameId:0,url:page,tab:{id:1,url:page}};
function fixture() {
  const map={},tabs=new Map();let created=0,removed=0;
  return {map,tabs,get created(){return created},get removed(){return removed},api:{
    storage:{session:{get:async key=>key===null?{...map}:({[key]:map[key]}),set:async x=>Object.assign(map,x)}},
    tabs:{create:async ({url})=>{created++; tabs.set(2,{id:2,url}); return tabs.get(2)}, get:async id=>tabs.get(id),update:async(id,x)=>{const tab=tabs.get(id);Object.assign(tab,x);return tab},remove:async id=>{removed++;tabs.delete(id)},onUpdated:{addListener:()=>{}}},
    scripting:{executeScript:async()=>[{result:'dialog_requested'}]},
  }};
}
const msg={type:'kitsnode.open-advertiser-login.v1',nonce,consent:true};
test('only exact page and minimal message can open the fixed Naver URL', async()=>{
 const f=fixture();assert.deepEqual(await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>100}),{status:'opened',nonce});
 assert.equal(f.tabs.get(2).url,'https://ads.naver.com/settings/ad-account');
 for(const bad of [{...sender,frameId:1},{...sender,url:page+'?x=1'}, {...sender,url:page.replace('/Kitsnode/','/attacker/')}]) assert.equal((await openAdvertiserLogin({chromeApi:f.api,message:msg,sender:bad})).status,'blocked');
 assert.equal((await openAdvertiserLogin({chromeApi:f.api,message:{...msg,recipientId:'attacker'},sender})).status,'blocked');
 assert.equal((await openAdvertiserLogin({chromeApi:f.api,message:{...msg,consent:false},sender})).status,'blocked');assert.equal(f.created,1);
});
test('account selection binds one tab, exact URL, and expiry for continuation',async()=>{
 const f=fixture();await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>100});
 assert.equal((await bindSelectedAccount({chromeApi:f.api,nonce,tabId:2,accountId:'123',now:()=>101})).status,'blocked');
 f.tabs.set(2,{id:2,url:'https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited'});
 assert.equal((await bindSelectedAccount({chromeApi:f.api,nonce,tabId:3,accountId:'123',now:()=>101})).status,'blocked');
 assert.equal((await bindSelectedAccount({chromeApi:f.api,nonce,tabId:2,accountId:'123',now:()=>101})).status,'account_selected');
 assert.equal((await getBoundAdvertiserTab({chromeApi:f.api,nonce,now:()=>102})).status,'bound');
 f.tabs.set(2,{id:2,url:'https://ads.naver.com/manage/ad-accounts/456/settings/authorities/members/invited'});
 assert.equal((await getBoundAdvertiserTab({chromeApi:f.api,nonce,now:()=>103})).status,'blocked');
 assert.equal((await getBoundAdvertiserTab({chromeApi:f.api,nonce,now:()=>600100})).status,'blocked');
});
test('failed session persistence closes the created tab',async()=>{
 const f=fixture();f.api.storage.session.set=async()=>{throw Error('failure')};
 assert.equal((await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>100})).status,'unavailable');assert.equal(f.removed,1);
});
test('web client accepts only a correlated response from a configured extension',async()=>{
 const random={randomUUID:()=>nonce},ext='a'.repeat(32),calls=[];
 const runtime={sendMessage:async(id,data)=>{calls.push([id,data]);return {status:'opened',nonce:data.nonce}}};
 assert.deepEqual(await startAdvertiserLogin({extensionId:ext,runtime,crypto:random,consent:true}),{status:'opened'});
 assert.equal(calls[0][1].type,msg.type);assert.equal(calls[0][1].nonce,nonce);
 assert.equal((await startAdvertiserLogin({extensionId:'unknown',runtime,crypto:random,consent:true})).status,'unavailable');
 assert.equal((await startAdvertiserLogin({extensionId:ext,runtime,crypto:random,consent:false})).status,'unavailable');
 runtime.sendMessage=async()=>({status:'opened',nonce:'different'});
 assert.equal((await startAdvertiserLogin({extensionId:ext,runtime,crypto:random,consent:true})).status,'unavailable');
});
test('extension worker forwards authorized web messages to the bounded login handler',async()=>{
 const f=fixture(); let listener; f.api.runtime={onMessageExternal:{addListener:fn=>{listener=fn}}};
 registerWebStartWorker(f.api);
 const response=await new Promise(resolve=>assert.equal(listener(msg,sender,resolve),true));
 assert.deepEqual(response,{status:'opened',nonce}); assert.equal(f.tabs.get(2).url,'https://ads.naver.com/settings/ad-account');
 const bad=await new Promise(resolve=>listener(msg,{...sender,url:'https://evil.test/'},resolve));
 assert.equal(bad.status,'blocked'); assert.equal(f.created,1);
});
test('repeated starts from one web tab do not create duplicate tabs',async()=>{
 const f=fixture();await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>100});
 assert.equal((await openAdvertiserLogin({chromeApi:f.api,message:{...msg,nonce:'22222222-2222-4222-8222-222222222222'},sender,now:()=>101})).status,'blocked');assert.equal(f.created,1);
});
test('concurrent messages from the same web tab are rejected while opening',async()=>{
 const f=fixture();let listener,release;
 f.api.tabs.create=async()=>{await new Promise(resolve=>{release=resolve});return {id:2}};
 f.api.runtime={onMessageExternal:{addListener:fn=>{listener=fn}}};registerWebStartWorker(f.api);
 const first=new Promise(resolve=>listener(msg,sender,resolve));
 const second=await new Promise(resolve=>listener(msg,sender,resolve));
 assert.equal(second.status,'blocked');await new Promise(resolve=>setImmediate(resolve));release();assert.equal((await first).status,'opened');
});
test('worker listeners are registered only once per Chrome instance',()=>{
 const f=fixture();let messages=0,updates=0;
 f.api.runtime={onMessageExternal:{addListener:()=>{messages++}}}; f.api.tabs.onUpdated.addListener=()=>{updates++};
 registerWebStartWorker(f.api);registerWebStartWorker(f.api);assert.equal(messages,1);assert.equal(updates,1);
});
test('the selected Naver tab routes to its exact member screen and opens only the policy dialog',async()=>{
 const f=fixture();await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>Date.now()});
 f.tabs.set(2,{id:2,url:'https://ads.naver.com/manage/ad-accounts/123/dashboard'});
 assert.equal((await advanceAdvertiserTab(f.api,2)).status,'routing');
 assert.equal(f.tabs.get(2).url,'https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');
 assert.equal((await advanceAdvertiserTab(f.api,2)).status,'policy_screen_requested');
 assert.equal((await getBoundAdvertiserTab({chromeApi:f.api,nonce})).status,'bound');
});
test('unrelated or expired account tabs never navigate',async()=>{
 const f=fixture();await openAdvertiserLogin({chromeApi:f.api,message:msg,sender,now:()=>100});
 f.tabs.set(2,{id:2,url:'https://ads.naver.com/manage/ad-accounts/123/dashboard'});
 assert.equal((await routeSelectedAdvertiserTab({chromeApi:f.api,tabId:2,now:()=>600100})).status,'blocked');
 assert.equal((await advanceAdvertiserTab(f.api,3)).status,'unavailable');
});
