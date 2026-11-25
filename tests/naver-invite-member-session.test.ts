import test from 'node:test';
import assert from 'node:assert/strict';
import { startAdvertiserLoginForMember } from '../src/lib/naver-invite-extension.mjs';

const session = (id:string, token='token') => ({data:{session:{user:{id},access_token:token}}});

test('opens the extension only for the current signed-in member', async () => {
  let called=0;
  const out=await startAdvertiserLoginForMember({getSession:async()=>session('member'),currentUserId:'member',isCurrent:id=>id==='member',consent:true,start:async options=>{called++;assert.deepEqual(options,{consent:true});return {status:'opened'};}});
  assert.deepEqual(out,{status:'opened'});assert.equal(called,1);
});

test('does not start for a missing token, a different member, or a changed session', async () => {
  for(const [response,current] of [[session('member',''),true],[session('other'),true],[session('member'),false]] as const){
    let called=0;
    const out=await startAdvertiserLoginForMember({getSession:async()=>response,currentUserId:'member',isCurrent:()=>current,start:async()=>{called++;return {status:'opened'};}});
    assert.deepEqual(out,{status:'unavailable'});assert.equal(called,0);
  }
});

test('does not report success after a user switch while extension responds',async()=>{
  let current=true;
  const out=await startAdvertiserLoginForMember({getSession:async()=>session('member'),currentUserId:'member',isCurrent:()=>current,start:async()=>{current=false;return {status:'opened'};}});
  assert.deepEqual(out,{status:'unavailable'});
});
