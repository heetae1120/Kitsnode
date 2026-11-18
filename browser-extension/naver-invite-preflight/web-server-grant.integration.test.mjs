// Local integration only: authentication, ownership proof and persistence are
// simulated. This does not exercise a deployed server or the Naver site.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInviteGrantService} from '../../keyword-api/src/invite-grant-service.mjs';
import {createWebApprovedLaunch} from './web-approved-launch.mjs';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const nonce='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
test('server-issued bound grant reaches controller once and cannot be replayed',async()=>{
 let row;let started=0;const memory={};
 const server=createInviteGrantService({auth:{verify:async()=>({userId,sessionId})},requests:{get:async()=>({requestId,userId,accountId:'123',status:'pending_review',consent:true,revision:1})},authorizeAdvertiser:async()=>true,
  repository:{insert:async input=>{if(row)return false;row=input;return true},consume:async input=>{if(!row||row.secretHash!==input.secretHash||row.nonce!==input.nonce||row.accountId!==input.accountId||row.viewerId!==input.viewerId)return null;const r=row;row=null;return r;}}});
 const grant=await server.issue({token:'user-token',requestId,nonce,accountId:'123',viewerId:'advertiser'});assert.equal(grant.status,'issued');
 const chromeApi={storage:{session:{set:async x=>Object.assign(memory,x),remove:async key=>delete memory[key]}},tabs:{create:async()=>{started++}},runtime:{getURL:x=>'chrome-extension://fixture/'+x}};
 const launch=createWebApprovedLaunch({chromeApi,locks:{request:async(_key,_options,run)=>run({})},readBound:async()=>({status:'bound',tabId:5,accountId:'123'}),observeViewer:async()=>'advertiser',verifyAndConsume:server.consume});
 assert.equal((await launch({nonce,grant:grant.grant})).status,'controller_started');
 assert.equal((await launch({nonce,grant:grant.grant})).status,'blocked');assert.equal(started,1);
 assert.equal(Object.values(memory)[0].viewerId,'advertiser');assert.equal(JSON.stringify(memory).includes(grant.grant),false);
});
