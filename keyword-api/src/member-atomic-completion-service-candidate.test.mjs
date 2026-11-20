import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtomicCompletionServiceCandidate} from './member-atomic-completion-service-candidate.mjs';

const uid='00000000-0000-4000-8000-000000000001';
const docs=()=>({termsVersion:'v1',privacyVersion:'p1',termsSha256:'a'.repeat(64),privacySha256:'b'.repeat(64),revision:4});
const input=()=>({name:'홍길동',username:'Seller_01',email:'owner@example.test',phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'p1'});
const user={id:uid,email:'owner@example.test',emailConfirmed:true,emailProvider:true};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({current,verify,verifyReceipt,atom}={}) {
 const calls=[];let legacyCalls=0;
 const legacy=()=>{legacyCalls++;throw Error('legacy must never be used')};
 const service=createAtomicCompletionServiceCandidate({readActiveDocuments:async()=>{calls.push('documents');return current?current():docs()},
  verifySession:async token=>{calls.push('session');return verify?verify(token):user},
  verifyDocumentReceipt:async proof=>{calls.push('receipt');return verifyReceipt?verifyReceipt(proof):true},
  atomicAdapter:{contract:'member-atomic-completion-v1',legacyComplete:legacy,complete:async payload=>{calls.push(['atomic',payload]);return atom?atom(payload):'created'}}});
 return {service,calls,legacyCount:()=>legacyCalls};
}
const request=()=>({token:'test-session-jwt',input:input(),documents:docs(),documentReceipt:'receipt_'.repeat(8)});

test('requires an explicit atomic adapter and trusted dependency functions',()=>{
 assert.throws(()=>createAtomicCompletionServiceCandidate({}),/invalid_dependencies/);
 assert.throws(()=>createAtomicCompletionServiceCandidate({readActiveDocuments:async()=>docs(),verifySession:async()=>user,atomicAdapter:{contract:'legacy',complete:async()=>{}}}),/invalid_dependencies/);
});
test('exact current versions, hashes, revision and confirmations enter only atomic adapter',async()=>{
 const f=fixture();assert.deepEqual(await f.service.complete(request()),{ok:true,code:'profile_completed'});
 assert.equal(f.legacyCount(),0);assert.deepEqual(f.calls.map(x=>Array.isArray(x)?x[0]:x),['session','receipt','documents','atomic']);
 const p=f.calls[3][1];assert.equal(p.profile.username,'seller_01');assert.equal(p.profile.email,user.email);
 assert.deepEqual(p.documents,docs());assert.equal(p.token,'test-session-jwt');assert.equal(p.ageConfirmed,true);
 assert.equal(Object.hasOwn(p,'userId'),false);assert.equal(Object.hasOwn(p.profile,'password'),false);
});
test('invalid or unauthenticated input cannot reach the adapter',async()=>{
 const bad=[{token:''},{documentReceipt:''},{input:{...input(),termsAccepted:false}},{input:{...input(),privacyAccepted:false}},
 {input:{...input(),ageConfirmed:false}},{documents:{...docs(),termsSha256:'A'.repeat(64)}},
 {documents:{...docs(),revision:0}},{documents:{...docs(),revision:Number.MAX_SAFE_INTEGER+1}},
 {documents:{...docs(),termsVersion:'../evil'}},{input:{...input(),phone:'010\t1234\t5678'}}];
 for(const change of bad){const f=fixture();const out=await f.service.complete({...request(),...change});assert.equal(out.ok,false);assert.equal(f.calls.some(Array.isArray),false);}
 for(const session of [null,{...user,emailConfirmed:false},{...user,emailProvider:false},{...user,id:'not-uuid'},{...user,email:'other@example.test'}]){
  const f=fixture({verify:async()=>session});assert.equal((await f.service.complete(request())).code,'verification_required');assert.equal(f.calls.some(Array.isArray),false);
 }
});
test('changed version, hash or revision is refused before atomic call',async()=>{
 for(const change of [{termsVersion:'v2'},{privacyVersion:'p2'},{termsSha256:'c'.repeat(64)},{privacySha256:'d'.repeat(64)},{revision:5}]){
  const f=fixture({current:()=>({...docs(),...change})});assert.equal((await f.service.complete(request())).code,'document_changed');assert.equal(f.calls.some(Array.isArray),false);
 }
});
test('authoritative document failure never executes atomic operation',async()=>{
 for(const current of [()=>null,()=>({...docs(),termsSha256:'invalid'}),()=>{throw Error('offline')}]){
  const f=fixture({current});assert.equal((await f.service.complete(request())).code,'unavailable');assert.equal(f.calls.some(Array.isArray),false);
 }
});
test('database recheck propagates document change, logout, contested username and existing profile',async()=>{
 for(const [db,expected] of [['document_changed','document_changed'],['unauthenticated','verification_required'],['verification_required','verification_required'],['username_taken','username_taken'],['profile_exists','profile_exists'],['consent_unavailable','consent_unavailable']]){
  const f=fixture({atom:async()=>db});assert.deepEqual(await f.service.complete(request()),{ok:false,code:expected});assert.equal(f.calls.filter(Array.isArray).length,1);
 }
});
test('known idempotent atomic result may succeed while unexpected results never do',async()=>{
 const f=fixture({atom:async()=> 'already_registered'});assert.equal((await f.service.complete(request())).code,'profile_completed');
 for(const response of [undefined,null,{},true,'success']){
  const bad=fixture({atom:async()=>response});assert.deepEqual(await bad.service.complete(request()),{ok:false,code:'completion_unconfirmed'});
 }
});
test('lost atomic response remains uncertain and is not retried',async()=>{
 const f=fixture({atom:async()=>{throw Error('response lost')}});assert.deepEqual(await f.service.complete(request()),{ok:false,code:'completion_unconfirmed'});
 assert.equal(f.calls.filter(Array.isArray).length,1);
});
test('confirmed data and document snapshots cannot change across asynchronous verification',async()=>{
 const pending=deferred(),r=request();const f=fixture({verify:()=>pending.promise});const work=f.service.complete(r);await tick();
 r.input.username='attacker';r.input.email='attacker@example.test';r.documents.termsSha256='c'.repeat(64);pending.resolve(user);
 assert.equal((await work).code,'profile_completed');const p=f.calls.find(Array.isArray)[1];
 assert.equal(p.profile.username,'seller_01');assert.equal(p.profile.email,'owner@example.test');assert.equal(p.documents.termsSha256,'a'.repeat(64));
});
test('session verification failure or exception never uses legacy or atomic path',async()=>{
 for(const verify of [async()=>null,async()=>{throw Error('offline')}]){
  const f=fixture({verify});const result=await f.service.complete(request());assert.equal(result.ok,false);assert.equal(f.calls.some(Array.isArray),false);assert.equal(f.legacyCount(),0);
 }
});

test('requires trusted document receipt bound to user, session and displayed metadata',async()=>{
 const requests=[];
 const f=fixture({verifyReceipt:proof=>{requests.push(proof);return proof.receipt==='receipt_'.repeat(8) && proof.userId===uid && proof.token==='test-session-jwt' && proof.documents.termsSha256==='a'.repeat(64) && proof.documents.revision===4}});
 assert.equal((await f.service.complete(request())).code,'profile_completed');
 assert.equal(requests.length,1);assert.deepEqual(requests[0].documents,docs());
 for(const change of [{documentReceipt:'forged'.repeat(8)},{token:'another-session'},{documents:{...docs(),termsSha256:'c'.repeat(64)}},{documents:{...docs(),revision:5}}]){
  const before=f.calls.filter(Array.isArray).length;assert.equal((await f.service.complete({...request(),...change})).code,'document_unverified');assert.equal(f.calls.filter(Array.isArray).length,before);
 }
 const offline=fixture({verifyReceipt:()=>{throw Error('offline')}});assert.equal((await offline.service.complete(request())).code,'unavailable');assert.equal(offline.calls.some(Array.isArray),false);
});
test('missing document receipt verifier is not accepted even with a compliant atomic adapter',()=>{
 assert.throws(()=>createAtomicCompletionServiceCandidate({readActiveDocuments:async()=>docs(),verifySession:async()=>user,atomicAdapter:{contract:'member-atomic-completion-v1',complete:async()=> 'created'}}),/invalid_dependencies/);
});

test('the versions acknowledged in input must exactly match the document snapshot',async()=>{
 for(const change of [{termsVersion:'old'},{privacyVersion:'old'},{termsVersion:undefined},{privacyVersion:undefined}]){
  const f=fixture();const result=await f.service.complete({...request(),input:{...input(),...change}});
  assert.deepEqual(result,{ok:false,code:'document_changed'});assert.deepEqual(f.calls,[]);
 }
});
