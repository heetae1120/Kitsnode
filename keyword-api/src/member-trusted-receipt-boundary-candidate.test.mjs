import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrustedReceiptBoundaryCandidate} from './member-trusted-receipt-boundary-candidate.mjs';
const user='00000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000001',now=1700000000000;
const docs={termsVersion:'v1',privacyVersion:'p1',termsSha256:'a'.repeat(64),privacySha256:'b'.repeat(64),revision:1};
const input={name:'홍길동',username:'Seller_01',email:'a@example.test',phone:'01012345678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'p1'};
function fixture({verified,sessionValue,active,execute,clock}={}){
 const calls=[];const svc=createTrustedReceiptBoundaryCandidate({verifySession:async()=>sessionValue===undefined?{id:user,sessionId:session,jwtExpiresMs:now+60000,emailConfirmed:true,emailProvider:true,email:input.email}:sessionValue,
 verifySignedReceipt:async()=>verified===undefined?{userId:user,sessionId:session,nonceHash:'c'.repeat(64),generation:7,issuedMs:now-1,expiresMs:now+30000,documents:docs}:verified,
 readActiveDocuments:async()=>active===undefined?docs:active,atomicAdapter:{contract:'member-trusted-receipt-db-v1',complete:async payload=>{calls.push(payload);return execute?execute(payload):'created'}},now:clock||(()=>now)});
 return {svc,calls};
}
const req={token:'synthetic',receipt:'receipt'.repeat(8),input};
test('forwards only verified identity, expiry, generation and document snapshot to trusted adapter',async()=>{
 const f=fixture();assert.deepEqual(await f.svc.complete({...req,expiresMs:now+999999,generation:999,userId:'attacker'}),{ok:true,code:'profile_completed'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].identity.userId,user);assert.equal(f.calls[0].proof.generation,7);assert.equal(f.calls[0].proof.expiresMs,now+30000);assert.equal(f.calls[0].profile.username,'seller_01');
});
test('an expired trusted receipt or session stops before write',async()=>{
 const expired={userId:user,sessionId:session,nonceHash:'c'.repeat(64),generation:7,issuedMs:now-1000,expiresMs:now,documents:docs};
 const f=fixture({verified:expired});assert.equal((await f.svc.complete(req)).code,'verification_required');assert.equal(f.calls.length,0);
 const sessionExpired=fixture({sessionValue:{id:user,sessionId:session,jwtExpiresMs:now,emailConfirmed:true,emailProvider:true,email:input.email}});assert.equal((await sessionExpired.svc.complete(req)).code,'verification_required');assert.equal(sessionExpired.calls.length,0);
});
test('different active document versions and failed dependencies cannot write',async()=>{
 const changed=fixture({active:{...docs,revision:2}});assert.equal((await changed.svc.complete(req)).code,'document_changed');assert.equal(changed.calls.length,0);
 const missing=fixture({verified:null});assert.equal((await missing.svc.complete(req)).code,'document_unverified');assert.equal(missing.calls.length,0);
});
test('unknown DB result and lost response remain uncertain, without retries',async()=>{
 for(const execute of [async()=>undefined,async()=>{throw Error('lost')}]){const f=fixture({execute});assert.equal((await f.svc.complete(req)).code,'completion_unconfirmed');assert.equal(f.calls.length,1);}
});
test('missing trusted dependencies or contract fails closed',()=>{
 assert.throws(()=>createTrustedReceiptBoundaryCandidate({}),TypeError);
});
