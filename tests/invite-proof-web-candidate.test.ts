import test from 'node:test';
import assert from 'node:assert/strict';
import {NAVER_INVITE_POLICY_VERSION,NAVER_INVITE_POLICY_DIGEST} from '../src/lib/naver-invite-policy.mjs';
import {approveInviteProofCandidate} from '../src/lib/invite-proof-web-candidate.mjs';

const userId='11111111-1111-4111-8111-111111111111',consentId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333',nonce='44444444-4444-4444-8444-444444444444',digest='a'.repeat(64),extension='a'.repeat(32);
function fixture(){
 const calls:{kind:string;value:any}[]=[];let active=true;
 const request={requestId,consentId,accountId:'123',viewerId:'advertiser',consentDigest:`sha256:${digest}`,consentVersion:'v1',naverPolicyVersion:NAVER_INVITE_POLICY_VERSION,naverPolicyDigest:`sha256:${NAVER_INVITE_POLICY_DIGEST}`,recipientId:'kitsnode',role:'OPERATIONS_VIEWER',autoPolicy:true,publicKey:{kty:'EC',crv:'P-256',x:'A'.repeat(43),y:'B'.repeat(43),ext:true}};
 const runtime={sendMessage:async (_id:string,m:any)=>{calls.push({kind:'extension',value:m});return m.type==='kitsnode.proof.start.v2'?{status:'started'}:m.type==='kitsnode.proof.prepare.v2'?{status:'pending'}:m.type==='kitsnode.proof.get.v2'?{status:'ready',request}:{status:'signalled'};}};
 const args={userId,consentId,accountId:'123',consentVersion:'v1',policyDigest:digest,nonce,extension,runtime,wait:async()=>{},signal:new AbortController().signal,isCurrent:()=>active,getSession:async()=>({data:{session:{user:{id:userId},access_token:'bearer.token'}}}),fetcher:async (url:any,init:any)=>{calls.push({kind:'server',value:{url,init}});return Response.json({status:'approved'});}};
 return {args,request,calls,logout:()=>{active=false}};
}
test('member token goes only to the fixed server and extension receives identifiers only',async()=>{
 const f=fixture();assert.deepEqual(await approveInviteProofCandidate(f.args),{status:'approved'});
 assert.deepEqual(f.calls.map(x=>x.kind),['extension','extension','extension','server','extension']);
 for(const c of f.calls.filter(x=>x.kind==='extension'))assert.doesNotMatch(JSON.stringify(c.value),/bearer|token|session/i);
 assert.equal(f.calls[3].value.url,'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/proof/approve');
 assert.deepEqual(JSON.parse(f.calls[3].value.init.body),{consentId,request:f.request});
});
test('rejects other consent, account, viewer, private keys and wrong digest before server',async()=>{
 for(const mutate of [(r:any)=>r.consentId=nonce,(r:any)=>r.accountId='456',(r:any)=>r.viewerId='kitsnode',(r:any)=>r.consentDigest='sha256:'+'b'.repeat(64),(r:any)=>r.publicKey.d='secret',(r:any)=>r.naverPolicyDigest='sha256:'+'c'.repeat(64),(r:any)=>r.naverPolicyVersion='old']){
  const f=fixture();mutate(f.request);assert.deepEqual(await approveInviteProofCandidate(f.args),{status:'blocked'});assert.equal(f.calls.filter(x=>x.kind==='server').length,0);
 }
});
test('no extension wake after logout, server refusal or unknown result',async()=>{
 for(const mode of ['logout','refuse','invalid']){
  const f=fixture();f.args.fetcher=async()=>{if(mode==='logout')f.logout();return mode==='refuse'?new Response('',{status:403}):Response.json({status:mode==='invalid'?'other':'approved'});};
  assert.deepEqual(await approveInviteProofCandidate(f.args),{status:'blocked'});assert.equal(f.calls.filter(x=>x.kind==='extension').length,3);
 }
});
test('waits for the consent-bound account to be selected before polling proof',async()=>{
 const f=fixture();let attempts=0;const original=f.args.runtime.sendMessage;
 f.args.runtime.sendMessage=async(id,m)=>{if(m.type==='kitsnode.proof.prepare.v2'&&attempts++===0){f.calls.push({kind:'extension',value:m});return {status:'selecting'};}return original(id,m);};
 assert.deepEqual(await approveInviteProofCandidate(f.args),{status:'approved'});
 assert.equal(attempts,2);
 assert.ok(f.calls.filter(x=>x.kind==='extension'&&x.value.type==='kitsnode.proof.prepare.v2').every(x=>x.value.accountId==='123'&&x.value.consentId===consentId));
});
test('does not contact the server after the login session changes',async()=>{
 const f=fixture();let count=0;
 f.args.getSession=async()=>({data:{session:{user:{id:userId},access_token:++count===1?'bearer.token':'changed.token'}}});
 assert.deepEqual(await approveInviteProofCandidate(f.args),{status:'blocked'});
 assert.equal(f.calls.filter(x=>x.kind==='server').length,0);
});
