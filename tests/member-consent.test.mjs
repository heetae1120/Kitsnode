import test from 'node:test';
import assert from 'node:assert/strict';
import {bindConsentToUser,createMemberConsent,MEMBER_TERMS_VERSION as termsVersion,MEMBER_PRIVACY_VERSION as privacyVersion} from '../src/lib/member-consent.mjs';

const evidence={termsVersion,privacyVersion,termsAccepted:true,privacyAcknowledged:true};
function fixture({row=null,selectError=null,insertError=null}={}) {
  let writes=[];
  const query={select(){return this},eq(){return this},async maybeSingle(){return {data:row,error:selectError}},async insert(value){writes.push(value);return {error:insertError}}};
  const client={from(table){assert.equal(table,'kitsnode_member_consents');return query}};
  return {client,writes};
}
test('requires both confirmations and exact published versions before recording',async()=>{
  const f=fixture(); const api=createMemberConsent(f.client);
  for(const invalid of [{...evidence,termsAccepted:false},{...evidence,privacyAcknowledged:false},{...evidence,termsVersion:'old'},{}]) assert.equal((await api.accept(invalid)).ok,false);
  assert.equal(f.writes.length,0);
});
test('records only versions; user and time are supplied by server',async()=>{
  const f=fixture({row:{accepted_at:'2026-01-01T00:00:00Z'}}); const api=createMemberConsent(f.client);
  assert.deepEqual(await api.accept(evidence),{ok:true,code:'consent_recorded'});
  assert.deepEqual(f.writes,[{terms_version:termsVersion,privacy_version:privacyVersion}]);
});
test('failed reads or writes keep consent unconfirmed',async()=>{
  let f=fixture({selectError:{code:'denied'}}); assert.equal((await createMemberConsent(f.client).hasCurrent()).ok,false);
  f=fixture({insertError:{code:'denied'}}); assert.equal((await createMemberConsent(f.client).accept(evidence)).ok,false);
  f=fixture(); assert.equal((await createMemberConsent(f.client).accept(evidence)).ok,false);
});
test('duplicate insert succeeds only when the current record is confirmed',async()=>{
  let f=fixture({row:{accepted_at:'2026-01-01'},insertError:{code:'23505'}}); assert.equal((await createMemberConsent(f.client).accept(evidence)).ok,true);
  f=fixture({insertError:{code:'23505'}}); assert.equal((await createMemberConsent(f.client).accept(evidence)).ok,false);
});
test('a delayed consent response never unlocks a different signed-in account',async()=>{
  let current='user-a', resolve;
  const pending=new Promise(done=>{resolve=done});
  const bound=bindConsentToUser({accept:()=>pending},'user-a',()=>current);
  const request=bound(evidence);
  current='user-b';resolve({ok:true,code:'consent_recorded'});
  assert.deepEqual(await request,{ok:false,code:'session_changed'});
  assert.deepEqual(await bound(evidence),{ok:false,code:'session_changed'});
});
test('withdrawal only issues a delete for the selected user and verifies removal',async()=>{
  const calls=[];let present=true;
  const client={from:()=>({
    delete(){calls.push('delete');return {async eq(key,value){calls.push([key,value]);present=false;return {error:null}}}},
    select(){return this},eq(){return this},async limit(){return {data:present?[{user_id:'synthetic'}]:[],error:null}}
  })};
  const id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const api=createMemberConsent(client);
  assert.equal((await api.withdraw('bad-id')).ok,false);
  assert.deepEqual(await api.withdraw(id),{ok:true,code:'consent_withdrawn'});
  assert.deepEqual(calls,['delete',['user_id',id]]);
});
test('failed or unverifiable withdrawal does not claim success',async()=>{
  const client={from:()=>({
    delete(){return {async eq(){return {error:null}}}},select(){return this},eq(){return this},async limit(){return {data:[{user_id:'previous-version'}],error:null}}
  })};
  assert.equal((await createMemberConsent(client).withdraw('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).ok,false);
});
