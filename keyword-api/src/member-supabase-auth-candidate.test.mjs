import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberSupabaseAuthCandidate} from './member-supabase-auth-candidate.mjs';

const uid='00000000-0000-4000-8000-000000000001';
const user={id:uid,email:'seller@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},identities:[{provider:'email'}]};
const session={access_token:'access-token',refresh_token:'refresh-token'};
const evidence={termsVersion:'v1',privacyVersion:'p1',termsAccepted:true,privacyAcknowledged:true};
function setup(config={}){
 const calls=[],revoked=[];
 const createClient=(url,key,options)=>{
  calls.push({url,key,options});
  return {auth:{signUp:config.signUp || (async()=>({data:{user:{id:uid},session:null},error:null})),
   signInWithPassword:config.signIn || (async()=>({data:{user,session},error:null})),
   getUser:config.getUser || (async()=>({data:{user},error:null}))}};
 };
 const base={createClient,projectUrl:'https://test.supabase.co',expectedProjectUrl:'https://test.supabase.co',publicKey:'sb_publishable_test',redirectTo:'https://site.example.test/store/login/',expectedRedirectOrigin:'https://site.example.test',activeSession:async()=>true,revokeExactSession:async input=>{revoked.push(input);return true}};
 const adapter=createMemberSupabaseAuthCandidate({...base,...config.overrides});
 return {adapter,calls,revoked,base};
}

test('rejects secrets and mixed or untrusted origins at construction',()=>{
 const {base}=setup();
 for (const key of ['sb_secret_123','service_role','']) assert.throws(()=>createMemberSupabaseAuthCandidate({...base,publicKey:key}),/invalid_dependencies/);
 assert.throws(()=>createMemberSupabaseAuthCandidate({...base,projectUrl:'https://evil.example'}),/invalid_project_url/);
 assert.throws(()=>createMemberSupabaseAuthCandidate({...base,redirectTo:'https://evil.example/'}),/invalid_redirect/);
 assert.throws(()=>createMemberSupabaseAuthCandidate({...base,activeSession:undefined}),/invalid_dependencies/);
 assert.throws(()=>createMemberSupabaseAuthCandidate({...base,revokeExactSession:undefined}),/invalid_dependencies/);
});
test('signup uses isolated public SDK client, fixed redirect and consent evidence',async()=>{
 let received;const h=setup({signUp:async input=>{received=input;return {data:{user:{id:uid},session:null},error:null}}});
 assert.deepEqual(await h.adapter.signUp({email:'seller@example.test',password:'synthetic',evidence}),{accepted:true,userId:uid});
 assert.deepEqual(received.options.data.kitsnode_consent,evidence);
 assert.equal(received.options.emailRedirectTo,'https://site.example.test/store/login/');
 assert.deepEqual(h.calls[0].options.auth,{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit'});
});
test('duplicate response is normalized to opaque accepted identity and other errors fail closed',async()=>{
 const duplicate=setup({signUp:async()=>({error:{code:'user_already_exists'},data:{user:null,session:null}})});
 const out=await duplicate.adapter.signUp({email:'seller@example.test',password:'synthetic',evidence});
 assert.equal(out.accepted,true);assert.match(out.userId,/^[a-f0-9-]{36}$/);assert.notEqual(out.userId,uid);
 const failed=setup({signUp:async()=>({error:{code:'over_email_send_rate_limit'},data:null})});
 assert.deepEqual(await failed.adapter.signUp({email:'seller@example.test',password:'synthetic',evidence}),{accepted:false});
});
test('signup preserves unexpectedly issued session even if provider returned error',async()=>{
 const h=setup({signUp:async()=>({data:{user:null,session},error:{code:'partial'}})});
 assert.deepEqual(await h.adapter.signUp({email:'seller@example.test',password:'synthetic',evidence}),{accepted:false,session});
});
test('verification asks Supabase getUser with explicit JWT and independent active-session check',async()=>{
 const calls=[];const h=setup({getUser:async token=>{calls.push(['getUser',token]);return {data:{user},error:null}},overrides:{activeSession:async input=>{calls.push(['active',input]);return true}}});
 assert.deepEqual(await h.adapter.verifySession('good.jwt.token'),{id:uid,email:user.email,emailConfirmed:true,emailProvider:true});
 assert.deepEqual(calls,[['getUser','good.jwt.token'],['active',{accessToken:'good.jwt.token',expectedUserId:uid}]]);
});
test('unverified email, missing email identity, revoked session or errors deny access',async()=>{
 for (const bad of [{...user,email_confirmed_at:null},{...user,identities:[{provider:'custom:naver'}]},{...user,identities:undefined}]) {
  const h=setup({getUser:async()=>({data:{user:bad},error:null})});assert.equal(await h.adapter.verifySession('token'),null);
 }
 assert.equal(await setup({overrides:{activeSession:async()=>false}}).adapter.verifySession('token'),null);
 assert.equal(await setup({overrides:{activeSession:async()=>{throw Error('offline')}}}).adapter.verifySession('token'),null);
 assert.equal(await setup({getUser:async()=>({error:{code:'unauthorized'}})}).adapter.verifySession('token'),null);
});
test('password login verifies freshly issued user and rejects denied session with scoped revoke',async()=>{
 const h=setup();assert.deepEqual(await h.adapter.signInWithPassword({email:user.email,password:'synthetic'}),{user:{id:uid,email:user.email,emailConfirmed:true,emailProvider:true},session});
 assert.equal(h.calls.length,2);assert.notEqual(h.calls[0],h.calls[1]);
 const denied=setup({overrides:{activeSession:async()=>false,revokeExactSession:async input=>{denied.revoked.push(input);return true}}});
 assert.equal(await denied.adapter.signInWithPassword({email:user.email,password:'synthetic'}),null);
 assert.deepEqual(denied.revoked,[{accessToken:'access-token'}]);
});
test('failed or ambiguous revocation is an error; it never returns issued session',async()=>{
 for (const fn of [async()=>false,async()=>{throw Error('offline')}]) {
  const h=setup({overrides:{activeSession:async()=>false,revokeExactSession:fn}});
  await assert.rejects(()=>h.adapter.signInWithPassword({email:user.email,password:'synthetic'}));
  await assert.rejects(()=>h.adapter.revokeSession(session));
 }
});
test('shared clients are rejected to prevent cross-request session contamination',async()=>{
 const shared={auth:{getUser:async()=>({data:{user},error:null})}};
 const h=setup({overrides:{createClient:()=>shared}});
 assert.notEqual(await h.adapter.verifySession('one'),null);
 assert.equal(await h.adapter.verifySession('two'),null);
});

test('actual Supabase JS SDK uses distinct public clients against an isolated synthetic transport',async()=>{
 const {createClient}=await import('@supabase/supabase-js');const seen=[];
 const syntheticFetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input.url;
  seen.push({url,method:init.method||'GET'});
  if(url.includes('/signup'))return new Response(JSON.stringify({id:uid,email:user.email,identities:[{provider:'email'}]}),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('/token?grant_type=password'))return new Response(JSON.stringify({...session,token_type:'bearer',expires_in:3600,user}),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('/user'))return new Response(JSON.stringify(user),{status:200,headers:{'content-type':'application/json'}});
  throw Error('unexpected request');
 };
 const h=setup({overrides:{createClient:(url,key,options)=>createClient(url,key,{...options,global:{fetch:syntheticFetch}})}});
 assert.deepEqual(await h.adapter.signUp({email:user.email,password:'synthetic',evidence}),{accepted:true,userId:uid});
 const login=await h.adapter.signInWithPassword({email:user.email,password:'synthetic'});
 assert.equal(login?.user?.id,uid);assert.equal(login?.session?.access_token,session.access_token);
 assert.equal(seen.filter(x=>x.url.includes('/signup')).length,1);
 assert.equal(seen.filter(x=>x.url.includes('/token?grant_type=password')).length,1);
 assert.equal(seen.filter(x=>x.url.includes('/user')).length,1);
});

test('review-only adapter and onboarding service compose without exposing mapped email',async()=>{
 const {createMemberOnboardingCandidate,createSignupDraftCodec}=await import('./member-onboarding-candidate.mjs');
 const h=setup();let profile;
 const profiles={
  isUsernameAvailable:async()=>true,
  complete:async input=>{profile=input;return 'created'},
  resolveForPasswordLogin:async()=>({subject:uid,email:user.email}),
  memberAccessAllowed:async()=>true,
 };
 const service=createMemberOnboardingCandidate({auth:h.adapter,profiles,limit:{consume:async()=>true},codec:createSignupDraftCodec({key:Buffer.alloc(32,5)}),limitKey:Buffer.alloc(32,9),termsVersion:'v1',privacyVersion:'p1'});
 const input={name:'홍길동',username:'seller',password:'synthetic-password',passwordConfirmation:'synthetic-password',email:user.email,phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'p1'};
 const requested=await service.register({clientKey:'synthetic-client',input});
 assert.equal(requested.ok,true);assert.equal(requested.code,'signup_requested');assert.ok(requested.draft);
 assert.equal(requested.draft.includes(user.email),false);
 const inspected=await service.inspectDraft({clientKey:'synthetic-client',token:session.access_token,draft:requested.draft});
 assert.equal(inspected.code,'draft_ready');assert.equal(inspected.fields.username,'seller');
 const confirmation={termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'p1'};
 assert.equal((await service.complete({clientKey:'synthetic-client',token:session.access_token,draft:requested.draft,confirmation})).code,'profile_completed');
 assert.equal(profile.subject,uid);assert.equal(profile.expectedEmail,user.email);
 const result=await service.signIn({clientKey:'synthetic-client',username:'seller',password:'synthetic-password'});
 assert.deepEqual(result,{ok:true,code:'signed_in',session});assert.equal(JSON.stringify(result).includes(user.email),false);
});

test('linked identity follows the same primary-email rule as the candidate DB',async()=>{
 let checks=0;
 const identities=[{provider:'email'},{provider:'custom:naver'}];
 const naverPrimary={...user,app_metadata:{provider:'custom:naver'},identities};
 const denied=setup({getUser:async()=>({data:{user:naverPrimary},error:null}),overrides:{activeSession:async()=>{checks++;return true}}});
 assert.equal(await denied.adapter.verifySession('token'),null);assert.equal(checks,0);
 const emailPrimary={...user,app_metadata:{provider:'email'},identities};
 const allowed=setup({getUser:async()=>({data:{user:emailPrimary},error:null})});
 assert.equal((await allowed.adapter.verifySession('token'))?.id,uid);
 const missingProvider=setup({getUser:async()=>({data:{user:{...emailPrimary,app_metadata:{}}},error:null})});
 assert.equal(await missingProvider.adapter.verifySession('token'),null);
});
