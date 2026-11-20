import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberOnboardingGateCandidate} from '../supabase/functions/kitsnode-ad-api/src/member-onboarding-gate-candidate.mjs';
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
const gate=(record,consent=true)=>createMemberOnboardingGateCandidate({currentConsent:async()=>consent,readServerMembership:async()=>record});
test('allows only current consent plus an explicitly attested server membership',async()=>{
 for(const status of ['completed','verified_legacy','verified_naver']) assert.equal(await gate({userId:a,status})(a),true);
 for(const status of ['pending','unknown','revoked',null]) assert.equal(await gate({userId:a,status})(a),false);
 assert.equal(await gate({userId:a,status:'completed'},false)(a),false);
});
test('denies missing, mismatched and malformed records without trusting user claims',async()=>{
 assert.equal(await gate(null)(a),false);
 assert.equal(await gate({userId:b,status:'completed'})(a),false);
 assert.equal(await gate({userId:a,status:'completed'})('not-a-uuid'),false);
 assert.equal(await gate({userId:a,status:'pending',user_metadata:{status:'completed'}})(a),false);
});
test('consent and authoritative store errors fail closed',async()=>{
 const first=createMemberOnboardingGateCandidate({currentConsent:async()=>{throw Error('db')},readServerMembership:async()=>({userId:a,status:'completed'})});
 const second=createMemberOnboardingGateCandidate({currentConsent:async()=>true,readServerMembership:async()=>{throw Error('db')}});
 assert.equal(await first(a),false);assert.equal(await second(a),false);
});

test('connection HTTP rejects incomplete accounts before reading or writing while verified existing members remain usable',async()=>{
 const {createConnectionHttp}=await import('../supabase/functions/kitsnode-ad-api/src/connection-http.mjs');
 const records=new Map([[a,{userId:a,status:'pending'}],[b,{userId:b,status:'verified_legacy'}]]);
 let reads=0,writes=0;
 const memberAllowed=createMemberOnboardingGateCandidate({currentConsent:async()=>true,readServerMembership:async id=>records.get(id)});
 const handler=createConnectionHttp({allowedOrigins:['https://site.example'],verifySession:async token=>({id:token==='member-a'?a:b}),memberAllowed,allowRequest:async()=>true,
  listOwned:async()=>{reads++;return []},service:{request:async()=>{writes++;return {ok:true}},disconnect:async()=>({ok:true})}});
 const get=token=>new Request('https://api.example/api/ad-connections',{headers:{origin:'https://site.example',authorization:`Bearer ${token}`}});
 const post=token=>new Request('https://api.example/api/ad-connections',{method:'POST',headers:{origin:'https://site.example',authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({adAccountId:'123'})});
 assert.equal((await handler(get('member-a'))).status,403);
 assert.equal((await handler(post('member-a'))).status,403);
 assert.equal(reads,0);assert.equal(writes,0);
 assert.equal((await handler(get('member-b'))).status,200);
 assert.equal((await handler(post('member-b'))).status,201);
 assert.equal(reads,1);assert.equal(writes,1);
});
