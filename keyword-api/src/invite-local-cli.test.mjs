import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {runInviteLocalCli} from './invite-local-cli.mjs';

const output=()=>{let text='';return {stream:new Writable({write(c,e,cb){text+=c;cb();}}),text:()=>text};};
test('invalid account is refused before opening a browser',async()=>{
 const out=output();let calls=0;
 const code=await runInviteLocalCli({args:['chrome','../123','advertiser','recipient'],input:Readable.from([]),output:out.stream,run:async()=>{calls++}});
 assert.equal(code,2);assert.equal(calls,0);
});
test('reports prepared state without claiming a sent invitation',async()=>{
 const out=output();let observed;
 const code=await runInviteLocalCli({args:['chrome','123','advertiser','recipient'],input:Readable.from([]),output:out.stream,
  run:async x=>{observed=x;return {status:'prepared_only'}}});
 assert.equal(code,0);assert.equal(observed.accountId,'123');assert.match(out.text(),/초대는 발송되지 않았습니다/);
});
test('unverified session remains unsuccessful',async()=>{
 const out=output();const code=await runInviteLocalCli({args:['chrome','123','advertiser','recipient'],input:Readable.from([]),output:out.stream,
  run:async()=>({status:'unverified'})});
 assert.equal(code,1);assert.match(out.text(),/확인하지 못했습니다/);
});
