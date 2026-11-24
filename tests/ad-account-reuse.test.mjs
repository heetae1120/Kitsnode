import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateWebMessageV2} from '../browser-extension/naver-invite-preflight/consent-message-v2-candidate.mjs';
import {naverPolicyVersion,naverPolicyDigest} from '../browser-extension/naver-invite-preflight/consent-proof-bridge-v2-candidate.mjs';
import {bindSelectedAccount} from '../browser-extension/naver-invite-preflight/web-start-bridge.mjs';
import {accountDiscovery} from '../browser-extension/naver-invite-preflight/account-discovery.mjs';

function fixture(){
 const data={selected_account_5:{siteTabId:5,naverTabId:10,accountId:'12345',expiresAt:2000}};
 const tabs=new Map([[10,{id:10,url:'https://ads.naver.com/manage/ad-accounts/12345/dashboard'}]]);
 const chromeApi={storage:{session:{async get(k){if(k===null)return {...data};if(Array.isArray(k))return Object.fromEntries(k.map(x=>[x,data[x]]));return {[k]:data[k]};},async set(x){Object.assign(data,x)},async remove(k){delete data[k];}}},tabs:{async get(k){if(!tabs.has(k))throw Error('closed');return tabs.get(k);},async update(k,v){Object.assign(tabs.get(k),v);},async create({url}){const t={id:11,url};tabs.set(11,t);return t;}}};
 const sender={tab:{id:5},frameId:0,url:'https://heetae1120.github.io/Kitsnode/store/ads/'};
 const message={type:'kitsnode.proof.start.v2',nonce:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',consentId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',accountId:'12345',consentVersion:'v1',consentDigest:'sha256:'+'a'.repeat(64),naverPolicyVersion,naverPolicyDigest};
 return {data,tabs,chromeApi,sender,message,call:()=>candidateWebMessageV2({chromeApi,message,sender,now:()=>1000})};
}
test('reuses only the previously selected live tab for the same consent account',async()=>{
 const f=fixture();assert.deepEqual(await f.call(),{status:'started'});
 const row=f.data['web_start_'+f.message.nonce];assert.equal(row.naverTabId,10);assert.equal(row.state,'account_routing');assert.equal(row.expectedConsentId,f.message.consentId);
 assert.equal(f.tabs.get(10).url,'https://ads.naver.com/manage/ad-accounts/12345/settings/authorities/members/invited');
 assert.equal(f.tabs.get(10).active,true);assert.equal(f.data.selected_account_5,undefined);
 assert.equal((await bindSelectedAccount({chromeApi:f.chromeApi,nonce:f.message.nonce,tabId:10,accountId:'12345',now:()=>1001})).status,'account_selected');
 const prepared=await candidateWebMessageV2({chromeApi:f.chromeApi,sender:f.sender,message:{...f.message,type:'kitsnode.proof.prepare.v2'},now:()=>1002});
 assert.deepEqual(prepared,{status:'pending'});assert.equal(f.data['candidate_prepare_v2_'+f.message.nonce].accountId,'12345');
});
test('a changed, expired, or wrong account is never silently reused',async()=>{
 for(const alter of [f=>f.data.selected_account_5.accountId='999',f=>f.data.selected_account_5.expiresAt=1000,f=>f.tabs.get(10).url='https://ads.naver.com/manage/ad-accounts/999/dashboard']){
  const f=fixture();alter(f);assert.deepEqual(await f.call(),{status:'started'});assert.equal(f.data['web_start_'+f.message.nonce].naverTabId,11);
 }
});
test('discovery result can be handed to the consent-bound start without a second account selection',async()=>{
 const f=fixture();delete f.data.selected_account_5;
 f.chromeApi.tabs.create=async({url})=>{const t={id:20,url};f.tabs.set(20,t);return t;};
 f.chromeApi.tabs.query=async()=>[...f.tabs.values()];
 const discoveryNonce='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const discover=type=>accountDiscovery({chromeApi:f.chromeApi,sender:f.sender,message:{type,nonce:discoveryNonce},now:()=>900});
 assert.deepEqual(await discover('kitsnode.account.start.v1'),{status:'started'});
 f.tabs.get(20).url='https://ads.naver.com/manage/ad-accounts/12345/dashboard';
 assert.deepEqual(await discover('kitsnode.account.get.v1'),{status:'selected',accountId:'12345'});
 assert.deepEqual(await f.call(),{status:'started'});
 assert.equal(f.data['web_start_'+f.message.nonce].naverTabId,20);
 assert.equal(f.tabs.get(20).url,'https://ads.naver.com/manage/ad-accounts/12345/settings/authorities/members/invited');
});
