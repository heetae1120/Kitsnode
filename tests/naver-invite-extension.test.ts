import test from 'node:test';
import assert from 'node:assert/strict';
import {startAdvertiserLogin} from '../src/lib/naver-invite-extension.mjs';
const id='a'.repeat(32),nonce='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const crypto={randomUUID:()=>nonce as `${string}-${string}-${string}-${string}-${string}`};
test('extension launch requires consent and valid ID and matches the response nonce',async()=>{
  const seen:unknown[]=[];
  const runtime={sendMessage:async(extensionId:string,message:{type:string;nonce:string})=>{seen.push({extensionId,message});return {status:'opened',nonce:message.nonce};}};
  assert.deepEqual(await startAdvertiserLogin({extensionId:id,runtime,crypto,consent:true}),{status:'opened'});
  assert.deepEqual(seen,[{extensionId:id,message:{type:'kitsnode.open-advertiser-login.v1',nonce,consent:true}}]);
  assert.deepEqual(await startAdvertiserLogin({extensionId:id,runtime,crypto,consent:false}),{status:'unavailable'});
  assert.deepEqual(await startAdvertiserLogin({extensionId:'bad',runtime,crypto,consent:true}),{status:'unavailable'});
  assert.equal(seen.length,1);
  assert.deepEqual(await startAdvertiserLogin({extensionId:id,runtime:{sendMessage:async()=>({status:'opened',nonce:'other'})},crypto,consent:true}),{status:'unavailable'});
});
