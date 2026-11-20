import test from 'node:test';
import assert from 'node:assert/strict';
import {createManualCompletionCoordinatorCandidate} from '../src/lib/member-complete-manual-coordinator-candidate.mjs';
import {MEMBER_TERMS_VERSION, MEMBER_PRIVACY_VERSION} from '../src/lib/member-consent.mjs';

const userId='00000000-0000-4000-8000-000000000001';
const input=()=>({name:'홍길동',username:'seller',email:'owner@example.test',phone:'01012345678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({insert,active,complete,makeClient}={}) {
 const events=[];let session={userId,sessionKey:'session-1'},recorded=false;
 const client={from(table){assert.equal(table,'kitsnode_member_consents');return {
  async insert(row){events.push(['insert',row,userId]);const result=insert?await insert(row):{error:null};if(!result?.error)recorded=true;return result},
  select(){return {eq(){return this},async maybeSingle(){events.push(['check',userId]);return {data:recorded?{accepted_at:'2026-01-01'}:null,error:null}}}}
 }}};
 const coordinator=createManualCompletionCoordinatorCandidate({userId,sessionKey:'session-1',currentSession:()=>session,
  verifyActiveSession:async args=>{events.push(['verify',args]);return active?active():true},
  createConsentClient:async args=>{events.push(['client',args]);return makeClient?makeClient():client},
  completeManual:async data=>{events.push(['complete',data]);return complete?complete(data):{ok:true,code:'profile_completed'}}});
 return {coordinator,events,get recorded(){return recorded},change:value=>{session=value},client};
}

test('records and confirms existing consent before verified manual completion',async()=>{
 const h=fixture();const result=await h.coordinator.complete(input());
 assert.deepEqual(result,{ok:true,code:'profile_completed'});
 assert.deepEqual(h.events.map(e=>e[0]),['verify','client','insert','check','verify','complete']);
 assert.equal(h.recorded,true);assert.deepEqual(h.events.find(e=>e[0]==='insert')[1],{terms_version:MEMBER_TERMS_VERSION,privacy_version:MEMBER_PRIVACY_VERSION});
 assert.deepEqual(await h.coordinator.complete(input()),{ok:false,code:'already_completed'});
});
test('all explicit confirmations and exact current versions are required before network calls',async()=>{
 for(const change of [{termsAccepted:false},{privacyAccepted:false},{ageConfirmed:false},{termsVersion:'old'},{privacyVersion:'old'}]) {
  const h=fixture();assert.equal((await h.coordinator.complete({...input(),...change})).code,'invalid_input');assert.deepEqual(h.events,[]);
 }
});
test('session change while creating scoped client prevents any consent write',async()=>{
 const pending=deferred();const h=fixture({makeClient:()=>pending.promise});const work=h.coordinator.complete(input());await tick();
 h.change({userId:'00000000-0000-4000-8000-000000000002',sessionKey:'session-2'});pending.resolve(h.client);
 assert.equal((await work).code,'session_changed');assert.equal(h.events.some(e=>e[0]==='insert'),false);assert.equal(h.events.some(e=>e[0]==='complete'),false);
});
test('session change during consent insert never starts completion for another account',async()=>{
 const pending=deferred();const h=fixture({insert:()=>pending.promise});const work=h.coordinator.complete(input());await tick();
 h.change({userId:'00000000-0000-4000-8000-000000000002',sessionKey:'session-2'});pending.resolve({error:null});
 assert.equal((await work).code,'session_changed');assert.equal(h.events.some(e=>e[0]==='complete'),false);
 // A previous scoped request can finish for its original subject; it never
 // proves the insert was rolled back and must not write as the new subject.
 assert.equal(h.events.find(e=>e[0]==='insert')[2],userId);
});
test('consent write or post-write confirmation failure never starts profile completion',async()=>{
 for (const insert of [async()=>({error:{code:'denied'}}),async()=>{throw Error('offline')}]) {
  const h=fixture({insert});assert.equal((await h.coordinator.complete(input())).code,'consent_unavailable');assert.equal(h.events.some(e=>e[0]==='complete'),false);
 }
 const bad={from(){return {insert:async()=>({error:null}),select(){return {eq(){return this},maybeSingle:async()=>({data:null,error:null})}}}}};
 const h=fixture({makeClient:()=>bad});assert.equal((await h.coordinator.complete(input())).code,'consent_unavailable');assert.equal(h.events.some(e=>e[0]==='complete'),false);
});
test('withdrawal or verification failure after consent prevents completion but leaves recorded consent visible',async()=>{
 let calls=0;const h=fixture({active:()=>++calls===1});
 assert.equal((await h.coordinator.complete(input())).code,'verification_required');
 assert.equal(h.recorded,true);assert.equal(h.events.some(e=>e[0]==='complete'),false);
});
test('concurrent submissions do not record consent or complete twice',async()=>{
 const pending=deferred();const h=fixture({insert:()=>pending.promise});const first=h.coordinator.complete(input());await tick();
 assert.equal((await h.coordinator.complete(input())).code,'busy');pending.resolve({error:null});
 assert.equal((await first).code,'profile_completed');assert.equal(h.events.filter(e=>e[0]==='insert').length,1);assert.equal(h.events.filter(e=>e[0]==='complete').length,1);
});
test('unknown completion result or network loss never claims success after consent',async()=>{
 for(const complete of [async()=>{throw Error('network')},async()=>({ok:true,code:'other'})]) {
  const h=fixture({complete});assert.equal((await h.coordinator.complete(input())).code,'completion_unconfirmed');assert.equal(h.recorded,true);
 }
});
test('profile conflict and missing consent remain explicit errors after existing consent path',async()=>{
 for(const code of ['profile_exists','consent_required','username_taken']) {
  const h=fixture({complete:async()=>({ok:false,code})});assert.deepEqual(await h.coordinator.complete(input()),{ok:false,code});
 }
});
test('session changes during completion suppress late success',async()=>{
 const pending=deferred();const h=fixture({complete:()=>pending.promise});const work=h.coordinator.complete(input());await tick();
 h.change(null);pending.resolve({ok:true,code:'profile_completed'});
 assert.equal((await work).code,'session_changed');assert.equal(h.recorded,true);
});

test('asynchronous consent cannot change the completed profile payload',async()=>{
 const pending=deferred();const h=fixture({insert:()=>pending.promise});const data={...input(),unexpected:'do-not-forward'};
 const work=h.coordinator.complete(data);await tick();data.username='different';data.email='other@example.test';pending.resolve({error:null});
 assert.equal((await work).code,'profile_completed');const payload=h.events.find(e=>e[0]==='complete')[1];
 assert.equal(payload.username,'seller');assert.equal(payload.email,'owner@example.test');assert.equal(Object.hasOwn(payload,'unexpected'),false);assert.equal(Object.isFrozen(payload),true);
});

test('coordinator composes with onboarding service only after consent is recorded',async()=>{
 const {createMemberOnboardingCandidate,createSignupDraftCodec}=await import('../keyword-api/src/member-onboarding-candidate.mjs');
 let h;const profileCalls=[];
 const service=createMemberOnboardingCandidate({
  auth:{verifySession:async()=>({id:userId,email:'owner@example.test',emailConfirmed:true,emailProvider:true})},
  profiles:{complete:async profile=>{profileCalls.push(profile);return h.recorded?'created':'consent_required'}},
  limit:{consume:async()=>true},codec:createSignupDraftCodec({key:Buffer.alloc(32,3)}),limitKey:Buffer.alloc(32,4),
  termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION,
 });
 h=fixture({complete:async payload=>service.completeManual({clientKey:'test-client',token:'test-token',input:payload})});
 assert.deepEqual(await h.coordinator.complete(input()),{ok:true,code:'profile_completed'});
 assert.equal(h.recorded,true);assert.equal(profileCalls.length,1);assert.equal(profileCalls[0].subject,userId);assert.equal(profileCalls[0].ageConfirmed,true);
});
