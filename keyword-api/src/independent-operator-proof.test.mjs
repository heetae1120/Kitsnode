import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createIndependentOperatorProofVerifier,operatorProofMessage} from './independent-operator-proof.mjs';
const id='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222',claim='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444',session='55555555-5555-4555-8555-555555555555';
const {publicKey,privateKey}=generateKeyPairSync('ed25519'),pem=publicKey.export({format:'pem',type:'spki'});
const fingerprint=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
const initial={id,operatorId:op,sessionId:session,keyId:'key1',keyFingerprint:fingerprint,operation:'resolve',claimId:claim,expectedState:'uncertain',caseRef:'CASE-123',evidenceHash:'a'.repeat(64),issuedAt:1000,expiresAt:301000};
const sig=c=>sign(null,operatorProofMessage(c),privateKey).toString('base64url');
function harness(){
 let c={...initial},clock=2000,used=false,active=true;const records=[];
 const verifier=createIndependentOperatorProofVerifier({now:()=>clock,lookupChallenge:async()=>({...c}),resolveKey:async()=>active?pem:null,commitVerified:async x=>{if(used||!active||clock>=c.expiresAt)return false;used=true;records.push(x);return true}});
 return {verifier,records,setChallenge:x=>{c={...c,...x}},setClock:x=>{clock=x},revoke:()=>{active=false}};
}
const call=(h,s=sig(initial),who=op)=>h.verifier({verifiedUserId:who,verifiedSessionId:session,challengeId:id,signature:s});
test('valid signature records once and concurrent replay is rejected',async()=>{
 const h=harness(),r=await Promise.all([call(h),call(h)]);assert.deepEqual(r.sort(),[false,true]);assert.equal(h.records.length,1);assert.equal(h.records[0].operatorId,op);assert.equal(h.records[0].claimId,claim);assert.match(h.records[0].challengeDigest,/^[a-f0-9]{64}$/);
});
test('signature is bound to subject, key, claim, state, case and expiry',async()=>{
 for(const change of [{operatorId:other},{sessionId:other},{keyId:'key2'},{keyFingerprint:'b'.repeat(64)},{operation:'review',evidenceHash:null},{claimId:other},{expectedState:'claimed'},{caseRef:'CASE-OTHER'},{evidenceHash:'b'.repeat(64)},{expiresAt:300000}]){const h=harness();h.setChallenge(change);assert.equal(await call(h),false);assert.equal(h.records.length,0)}
 const h=harness();assert.equal(await call(h,sig(initial),other),false);
});
test('invalid signature, wrong key, expired proof and revoked enrollment fail closed',async()=>{
 const h=harness(),bad=generateKeyPairSync('ed25519');assert.equal(await call(h,sign(null,operatorProofMessage(initial),bad.privateKey).toString('base64url')),false);assert.equal(await call(h,'x'.repeat(86)),false);
 h.setClock(initial.expiresAt);assert.equal(await call(h),false);h.setClock(2000);h.revoke();assert.equal(await call(h),false);assert.equal(h.records.length,0);
});
test('lookup errors, invalid input and overly long lifetime fail without recording',async()=>{
 const h=harness();assert.equal(await h.verifier({verifiedUserId:op,verifiedSessionId:session,challengeId:id,signature:'bad'}),false);h.setChallenge({expiresAt:initial.issuedAt+300001});assert.equal(await call(h),false);
 const fail=createIndependentOperatorProofVerifier({now:()=>2000,lookupChallenge:async()=>{throw Error('private')},resolveKey:async()=>pem,commitVerified:async()=>true});assert.equal(await fail({verifiedUserId:op,verifiedSessionId:session,challengeId:id,signature:sig(initial)}),false);
});
