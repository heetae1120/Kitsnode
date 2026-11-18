import test from 'node:test';
import assert from 'node:assert/strict';
import {createWebApprovedLaunch} from './web-approved-launch.mjs';

const nonce='12345678-1234-4234-8234-123456789abc';
function fixture({approved=true,changed=false,failOpen=false}={}) {
 const memory={},calls=[]; let reads=0;
 const chromeApi={storage:{session:{set:async x=>Object.assign(memory,x),remove:async key=>delete memory[key]}},tabs:{create:async x=>{calls.push(x);if(failOpen)throw Error()}},runtime:{getURL:p=>'chrome-extension://test/'+p}};
 const args={chromeApi,locks:{request:async(_k,_o,fn)=>fn({})},readBound:async()=>({status:'bound',tabId:7,accountId:'123'}),
  observeViewer:async()=>changed&&++reads>1?'other':'advertiser',verifyAndConsume:async x=>({...x,approved,userId:'user',requestId:'request'})};
 return {args,memory,calls};
}
test('verified one-use grant launches the bound controller without storing the grant',async()=>{
 const f=fixture();const result=await createWebApprovedLaunch(f.args)({nonce,grant:'a'.repeat(32)});
 assert.equal(result.status,'controller_started');assert.equal(f.calls.length,1);
 const records=Object.values(f.memory);assert.equal(records.length,1);assert.equal(records[0].tabId,7);assert.equal(records[0].accountId,'123');assert.equal(records[0].viewerId,'advertiser');assert.equal(JSON.stringify(records).includes('aaaa'),false);
});
test('unverified grant or changed browser identity cannot launch',async()=>{
 for(const opt of [{approved:false},{changed:true}]){const f=fixture(opt);assert.equal((await createWebApprovedLaunch(f.args)({nonce,grant:'a'.repeat(32)})).status,'blocked');assert.equal(f.calls.length,0);}
});
test('failure after grant consumption does not claim success or retain controller binding',async()=>{
 const f=fixture({failOpen:true});assert.deepEqual(await createWebApprovedLaunch(f.args)({nonce,grant:'a'.repeat(32)}),{status:'uncertain',retry:'disabled'});assert.deepEqual(f.memory,{});
});
test('invalid nonce fails before checking a grant',async()=>{const f=fixture();f.args.verifyAndConsume=async()=>{throw Error('called')};assert.equal((await createWebApprovedLaunch(f.args)({nonce:'bad',grant:'a'.repeat(32)})).status,'blocked');});
