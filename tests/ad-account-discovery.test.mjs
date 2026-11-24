import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountDiscovery} from '../browser-extension/naver-invite-preflight/account-discovery.mjs';
import {routeSelectedAdvertiserTab} from '../browser-extension/naver-invite-preflight/web-start-bridge.mjs';
const nonce='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(){
 const state={},tabs=new Map();let next=10;
 const chromeApi={storage:{session:{async get(key){if(key===null)return {...state};return {[key]:state[key]};},async set(values){Object.assign(state,values)},async remove(key){delete state[key]}}},tabs:{async create({url}){const tab={id:next++,url};tabs.set(tab.id,tab);return tab},async get(id){if(!tabs.has(id))throw Error('closed');return tabs.get(id)},async query(){return [...tabs.values()]},async update(id,changes){Object.assign(tabs.get(id),changes)}}};
 const sender={tab:{id:5},frameId:0,url:'https://heetae1120.github.io/Kitsnode/store/ads/'};
 const call=(type,s=sender,n=nonce)=>accountDiscovery({chromeApi,message:{type,nonce:n},sender:s,now:()=>1000});
 return {call,tabs,state,sender,chromeApi};
}
test('reads only the account selected in the extension-created Naver tab',async()=>{
 const f=fixture();assert.deepEqual(await f.call('kitsnode.account.start.v1'),{status:'started'});
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'selecting'});
 f.tabs.get(10).url='https://ads.naver.com/manage/ad-accounts/12345/dashboard';
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'selected',accountId:'12345'});
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'blocked'});
});
test('reads a unique account opened in a child tab and rejects ambiguous choices',async()=>{
 const f=fixture();await f.call('kitsnode.account.start.v1');
 f.tabs.set(11,{id:11,openerTabId:10,url:'https://ads.naver.com/manage/ad-accounts/12345/dashboard'});
 f.tabs.set(12,{id:12,openerTabId:99,url:'https://ads.naver.com/manage/ad-accounts/777/dashboard'});
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'selected',accountId:'12345'});
 const g=fixture();await g.call('kitsnode.account.start.v1');
 g.tabs.set(11,{id:11,openerTabId:10,url:'https://ads.naver.com/manage/ad-accounts/12345/dashboard'});
 g.tabs.set(12,{id:12,openerTabId:10,url:'https://ads.naver.com/manage/ad-accounts/67890/dashboard'});
 assert.deepEqual(await g.call('kitsnode.account.get.v1'),{status:'selecting'});
});
test('binds consent to the selected child tab and rejects a different account',async()=>{
 const f=fixture();f.state['web_start_'+nonce]={state:'login_opened',naverTabId:10,createdAt:900,expiresAt:2000,expectedAccountId:'12345'};
 f.tabs.set(11,{id:11,openerTabId:10,url:'https://ads.naver.com/manage/ad-accounts/999/dashboard'});
 assert.deepEqual(await routeSelectedAdvertiserTab({chromeApi:f.chromeApi,tabId:11,now:()=>1000}),{status:'blocked'});
 f.tabs.get(11).url='https://ads.naver.com/manage/ad-accounts/12345/dashboard';
 assert.deepEqual(await routeSelectedAdvertiserTab({chromeApi:f.chromeApi,tabId:11,now:()=>1000}),{status:'routing'});
 assert.equal(f.state['web_start_'+nonce].naverTabId,11);
 assert.equal(f.tabs.get(11).url,'https://ads.naver.com/manage/ad-accounts/12345/settings/authorities/members/invited');
});
test('rejects other sites, tabs, expired starts and misleading URLs',async()=>{
 const f=fixture();assert.deepEqual(await f.call('kitsnode.account.start.v1',{...f.sender,url:'https://example.com/'}),{status:'blocked'});
 await f.call('kitsnode.account.start.v1');
 assert.deepEqual(await f.call('kitsnode.account.get.v1',{...f.sender,tab:{id:6}}),{status:'blocked'});
 f.tabs.get(10).url='https://ads.naver.com.evil.test/manage/ad-accounts/12345/dashboard';
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'selecting'});
 f.state['account_discovery_'+nonce].expiresAt=1000;
 assert.deepEqual(await f.call('kitsnode.account.get.v1'),{status:'blocked'});
});
