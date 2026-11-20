import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createSignupDraftCodec,createMemberOnboardingCandidate} from './member-onboarding-candidate.mjs';
import {createMemberOnboardingHttpCandidate} from './member-onboarding-http-candidate.mjs';

const termsVersion='2026-11-14',privacyVersion='2026-11-14-naver';
const evidence={termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion,privacyVersion};
const sample=()=>({name:'홍길동',username:'Seller01',password:'safe-example-password',passwordConfirmation:'safe-example-password',email:'owner@example.test',phone:'010-1234-5678',...evidence});
const user={id:'subject-1',email:'owner@example.test',emailConfirmed:true,emailProvider:true};
function fixture({clock=()=>1_000_000,limitOverride,authOverride={},profileOverride={}}={}){
 const calls={signup:[],login:[],complete:[],revoked:[],limits:[],verified:[]};
 const profiles={async isUsernameAvailable(id){return id!=='taken'},async complete(value){calls.complete.push(value);return 'created'},async resolveForPasswordLogin(id){return id==='seller01'?{subject:user.id,email:user.email}:null},async memberAccessAllowed(){return true},...profileOverride};
 const auth={async signUp(value){calls.signup.push(value);return {accepted:true,userId:user.id,session:null}},async verifySession(token){calls.verified.push(token);return token.startsWith('good-')?user:null},async signInWithPassword(value){calls.login.push(value);return value.email===user.email&&value.password==='correct'?{user,session:{access_token:'access',refresh_token:'refresh',sensitive:'never-return'}}:{error:true}},async revokeSession(value){calls.revoked.push(value)},...authOverride};
 const limit={async consume(value){calls.limits.push(value);return limitOverride?limitOverride(value):true}};
 const codec=createSignupDraftCodec({key:Buffer.alloc(32,2),now:clock,ttlMs:60_000});
 const service=createMemberOnboardingCandidate({auth,profiles,limit,codec,limitKey:Buffer.alloc(32,3),termsVersion,privacyVersion});
 return {service,codec,calls};
}
const ck='trusted-source';
test('signup encrypts prefill, sends no password in draft and never reserves username',async()=>{
 const {service,codec,calls}=fixture();
 const result=await service.register({clientKey:ck,input:sample()});
 assert.equal(result.code,'signup_requested'); assert.equal(result.draft.includes('owner@example.test'),false); assert.equal(result.draft.includes('safe-example-password'),false);
 assert.equal(Object.hasOwn(codec.open(result.draft),'password'),false);assert.equal(calls.signup[0].email,'owner@example.test');
 assert.deepEqual(calls.signup[0].evidence,{termsVersion,privacyVersion,termsAccepted:true,privacyAcknowledged:true});assert.equal(calls.complete.length,0);
});
test('no active verified matching email or stale consent cannot read or claim draft',async()=>{
 const {service,codec,calls}=fixture(); const draft=codec.seal({email:'other@example.test',username:'seller01',name:'A',phone:'01012345678',termsVersion,privacyVersion,signupSubject:user.id});
 assert.equal((await service.inspectDraft({clientKey:ck,token:'good-token',draft})).code,'verification_required');
 assert.equal((await service.complete({clientKey:ck,token:'good-token',draft,confirmation:evidence})).code,'verification_required');
 assert.equal(calls.complete.length,0);
});
test('normal long JWT and upper limit are distinct from general text limits',async()=>{
 const {service,codec,calls}=fixture(); const draft=codec.seal({email:user.email,username:'seller01',name:'A',phone:'01012345678',termsVersion,privacyVersion,signupSubject:user.id});
 const jwt='good-'+ 'a'.repeat(3000);
 assert.equal((await service.inspectDraft({clientKey:ck,token:jwt,draft})).code,'draft_ready');
 assert.equal((await service.inspectDraft({clientKey:ck,token:'good-'+ 'a'.repeat(8192),draft})).code,'verification_required');
 assert.equal(calls.verified.length,1);
});
test('completion requires explicit fresh agreement, passes verified identity and handles ID conflict',async()=>{
 const {service,calls}=fixture({profileOverride:{async complete(v){calls.complete.push(v);return 'username_taken'}}});
 const result=await service.register({clientKey:ck,input:sample()});
 assert.equal((await service.complete({clientKey:ck,token:'good-token',draft:result.draft,confirmation:{...evidence,ageConfirmed:false}})).code,'invalid_input');
 assert.equal((await service.complete({clientKey:ck,token:'good-token',draft:result.draft,confirmation:evidence})).code,'username_taken');
 assert.equal(calls.complete[0].subject,user.id);assert.equal(calls.complete[0].expectedEmail,user.email);assert.equal(calls.complete[0].username,'seller01');
 assert.equal(JSON.stringify(calls.complete).includes('safe-example-password'),false);
});
test('on claimed username the verified member can choose a different ID without starting signup again',async()=>{
 const {service,calls}=fixture();const {draft}=await service.register({clientKey:ck,input:sample()});
 assert.equal((await service.complete({clientKey:ck,token:'good-token',draft,confirmation:evidence,replacementUsername:'new-user'})).code,'profile_completed');
 assert.equal(calls.complete[0].username,'new-user');
});
test('encrypted draft expires and tampering is rejected',()=>{
 let now=1_000_000;const codec=createSignupDraftCodec({key:randomBytes(32),now:()=>now,ttlMs:60_000});const draft=codec.seal({email:'owner@example.test'});
 assert.equal(codec.open(draft).email,'owner@example.test'); const i=20; const changed=draft.slice(0,i)+(draft[i]==='A'?'B':'A')+draft.slice(i+1);assert.equal(codec.open(changed),null);
 now+=60_000;assert.equal(codec.open(draft),null);
});
test('shared limiter failure prevents sign up, checks and password authentication',async()=>{
 const {service,calls}=fixture({limitOverride:()=>{throw Error('offline')}});
 assert.equal((await service.register({clientKey:ck,input:sample()})).code,'unavailable');
 assert.equal((await service.signIn({clientKey:ck,username:'seller01',password:'correct'})).code,'unavailable');
 assert.equal((await service.checkUsername({clientKey:ck,username:'seller01'})).code,'unavailable');
 assert.equal(calls.signup.length,0);assert.equal(calls.login.length,0);
});
test('unknown username, wrong password, and rejected member use identical login failure and do not leak email',async()=>{
 const f=fixture({profileOverride:{async memberAccessAllowed(){return false}}});
 const unknown=await f.service.signIn({clientKey:ck,username:'nobody',password:'correct'});
 const wrong=await f.service.signIn({clientKey:ck,username:'seller01',password:'wrong'});
 const denied=await f.service.signIn({clientKey:ck,username:'seller01',password:'correct'});
 assert.deepEqual(unknown,wrong);assert.deepEqual(wrong,denied);assert.equal(unknown.code,'sign_in_failed');assert.equal(f.calls.login.length,3);
 assert.equal(f.calls.revoked.length,1);assert.equal(JSON.stringify([unknown,wrong,denied]).includes(user.email),false);
});
test('successful sign in returns only session tokens, not resolved email or provider user',async()=>{
 const {service}=fixture();const result=await service.signIn({clientKey:ck,username:'Seller01',password:'correct'});
 assert.deepEqual(result,{ok:true,code:'signed_in',session:{access_token:'access',refresh_token:'refresh'}});assert.equal(JSON.stringify(result).includes(user.email),false);
});
test('active session returned by signup fails closed and is revoked',async()=>{
 const {service,calls}=fixture({authOverride:{async signUp(){return {accepted:true,userId:user.id,session:{access_token:'token'}}}}});
 assert.equal((await service.register({clientKey:ck,input:sample()})).code,'unavailable');assert.equal(calls.revoked.length,1);
});
test('HTTP boundary rejects cross-origin and overrides untrusted client and bearer fields',async()=>{
 let seen; const handler=createMemberOnboardingHttpCandidate({trustedOrigin:'https://kits.example',clientKeyFromRuntime:async()=>ck,service:{async complete(value){seen=value;return {ok:true,code:'profile_completed'}}}});
 const request=(origin,body,auth='Bearer real-token')=>new Request('https://api.example/complete',{method:'POST',headers:{origin,'content-type':'application/json',authorization:auth},body:JSON.stringify(body)});
 assert.equal((await handler(request('https://attacker.example',{}),'complete')).status,403);
 const result=await handler(request('https://kits.example',{clientKey:'forged',token:'forged'}),'complete');assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(seen.clientKey,ck);assert.equal(seen.token,'real-token');
});
test('CORS preflight allows only the exact configured origin and required headers',async()=>{
 const handler=createMemberOnboardingHttpCandidate({trustedOrigin:'https://kits.example',clientKeyFromRuntime:async()=>ck,service:{async complete(){return {ok:true}}}});
 const preflight=(origin,headers='content-type, authorization')=>new Request('https://api.example/complete',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':headers}});
 const good=await handler(preflight('https://kits.example'),'complete');assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-origin'),'https://kits.example');
 assert.equal(good.headers.get('access-control-allow-credentials'),null);
 const bad=await handler(preflight('https://attacker.example'),'complete');assert.equal(bad.status,403);assert.equal(bad.headers.get('access-control-allow-origin'),null);
 assert.equal((await handler(preflight('https://kits.example','x-evil'),'complete')).status,403);
 const badtype=await handler(new Request('https://api.example/complete',{method:'POST',headers:{origin:'https://kits.example','content-type':'text/plain'},body:'{}'}),'complete');
 assert.equal(badtype.status,415);assert.equal(badtype.headers.get('access-control-allow-origin'),'https://kits.example');
});
test('draft is bound to original Auth subject even if a later user owns the same email',async()=>{
 const first=fixture(); const draft=(await first.service.register({clientKey:ck,input:sample()})).draft;
 const second=fixture({authOverride:{async verifySession(){return {...user,id:'new-subject-after-deletion'}}}});
 assert.equal((await second.service.inspectDraft({clientKey:ck,token:'good-new-token',draft})).code,'verification_required');
 assert.equal((await second.service.complete({clientKey:ck,token:'good-new-token',draft,confirmation:evidence})).code,'verification_required');
 assert.equal(second.calls.complete.length,0);
});
test('confirmed member can recover from lost draft by re-entering information and consents',async()=>{
 const f=fixture(); const data={...sample()}; delete data.password;delete data.passwordConfirmation;
 assert.equal((await f.service.completeManual({clientKey:ck,token:'good-token',input:{...data,ageConfirmed:false}})).code,'invalid_input');
 assert.equal((await f.service.completeManual({clientKey:ck,token:'bad-token',input:data})).code,'verification_required');
 assert.equal((await f.service.completeManual({clientKey:ck,token:'good-token',input:{...data,email:'other@example.test'}})).code,'verification_required');
 assert.equal((await f.service.completeManual({clientKey:ck,token:'good-token',input:data})).code,'profile_completed');
 assert.equal(f.calls.complete.length,1);assert.equal(f.calls.complete[0].subject,user.id);
});
test('tab in phone number is rejected consistently before encrypted draft creation',async()=>{
 const f=fixture(); const result=await f.service.register({clientKey:ck,input:{...sample(),phone:'010\t1234\t5678'}});
 assert.equal(result.code,'invalid_input');assert.equal(f.calls.signup.length,0);
});
test('unexpected session is revoked even if signup response has no user ID',async()=>{
 const f=fixture({authOverride:{async signUp(){return {accepted:true,session:{access_token:'token'}}}}});
 assert.equal((await f.service.register({clientKey:ck,input:sample()})).code,'unavailable');assert.equal(f.calls.revoked.length,1);
});

test('missing persisted consent is preserved for draft and manual completion',async()=>{
 const f=fixture({profileOverride:{async complete(value){f.calls.complete.push(value);return 'consent_required'}}});
 const {draft}=await f.service.register({clientKey:ck,input:sample()});
 const manual={...sample()};delete manual.password;delete manual.passwordConfirmation;
 assert.deepEqual(await f.service.complete({clientKey:ck,token:'good-token',draft,confirmation:evidence}),{ok:false,code:'consent_required'});
 assert.deepEqual(await f.service.completeManual({clientKey:ck,token:'good-token',input:manual}),{ok:false,code:'consent_required'});
 assert.equal(f.calls.complete.length,2);
 // No consent persistence dependency exists: re-entering a checkbox is not a
 // recorded consent and must never be treated as profile completion.
});

test('repository verification failure is preserved for draft and manual completion',async()=>{
 const f=fixture({profileOverride:{async complete(){return 'verification_required'}}});
 const {draft}=await f.service.register({clientKey:ck,input:sample()});
 const manual={...sample()};delete manual.password;delete manual.passwordConfirmation;
 assert.deepEqual(await f.service.complete({clientKey:ck,token:'good-token',draft,confirmation:evidence}),{ok:false,code:'verification_required'});
 assert.deepEqual(await f.service.completeManual({clientKey:ck,token:'good-token',input:manual}),{ok:false,code:'verification_required'});
});

test('existing profile conflict is preserved without a retry or overwrite',async()=>{
 let attempts=0;
 const f=fixture({profileOverride:{async complete(){attempts++;return 'profile_exists'}}});
 const {draft}=await f.service.register({clientKey:ck,input:sample()});
 const manual={...sample()};delete manual.password;delete manual.passwordConfirmation;
 assert.deepEqual(await f.service.complete({clientKey:ck,token:'good-token',draft,confirmation:evidence}),{ok:false,code:'profile_exists'});
 assert.deepEqual(await f.service.completeManual({clientKey:ck,token:'good-token',input:manual}),{ok:false,code:'profile_exists'});
 assert.equal(attempts,2);
});
