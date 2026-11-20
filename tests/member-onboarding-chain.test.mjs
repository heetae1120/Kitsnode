// Cross-boundary contract test: client -> HTTP adapter -> service with synthetic auth.
// It does not replace real Supabase, email or DB integration verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberOnboardingClientCandidate} from '../src/lib/member-onboarding-client-candidate.mjs';
import {createMemberOnboardingCandidate, createSignupDraftCodec} from '../keyword-api/src/member-onboarding-candidate.mjs';
import {createMemberOnboardingHttpCandidate} from '../keyword-api/src/member-onboarding-http-candidate.mjs';

function setup(){
 const versions={termsVersion:'v1',privacyVersion:'v2'};
 const evidence={...versions,termsAccepted:true,privacyAccepted:true,ageConfirmed:true};
 const user={id:'subject-one',email:'seller@example.test',emailConfirmed:true,emailProvider:true};
 const sessions=new Map(),saved=new Map();let currentId=null,generation=0,profile=null;
 const auth={
  async signUp({email}){assert.equal(email,user.email);return {accepted:true,userId:user.id,session:null}},
  async verifySession(token){return sessions.get(token)||null},
  async signInWithPassword({email,password}){return email===user.email&&password==='secure-example' ? {user,session:{access_token:'access-one',refresh_token:'refresh-one'}} : {error:true}},
  async revokeSession(){}
 };
 const profiles={
  async isUsernameAvailable(id){return !profile||profile.username!==id},
  async complete(data){if(profile)return 'username_taken';profile={username:data.username,subject:data.subject,email:data.expectedEmail};return 'created'},
  async resolveForPasswordLogin(id){return profile?.username===id?profile:null},
  async memberAccessAllowed(id){return profile?.subject===id}
 };
 const service=createMemberOnboardingCandidate({auth,profiles,limit:{async consume(){return true}},codec:createSignupDraftCodec({key:Buffer.alloc(32,4)}),limitKey:Buffer.alloc(32,5),...versions});
 const handle=createMemberOnboardingHttpCandidate({service,trustedOrigin:'https://kits.example.test',clientKeyFromRuntime:async()=>'synthetic'});
 const paths={'check-username':'checkUsername',register:'register','inspect-draft':'inspectDraft',complete:'complete','complete-manual':'completeManual','sign-in':'signIn'};
 const fetchImpl=async (url,options)=>{
  const headers=new Headers(options.headers);headers.set('origin','https://kits.example.test');
  return handle(new Request(url,{...options,headers}),paths[new URL(url).pathname.split('/').at(-1)]);
 };
 const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const sessionBridge={snapshot:()=>({generation,accessToken:currentId}),isCurrent:s=>s.generation===generation,installIfCurrent:async(session,s)=>{if(s.generation!==generation)return false;currentId=session.access_token;generation++;return true},signOut:async()=>{currentId=null;generation++},revokeIssuedSession:async()=>{}};
 const client=createMemberOnboardingClientCandidate({apiOrigin:'https://api.example.test',expectedApiOrigin:'https://api.example.test',fetchImpl,storage,sessionBridge});
 return {client,evidence,sessions,confirm(){sessions.set('verified-one',user);currentId='verified-one';generation++},profile:()=>profile,saved};
}

test('signup draft crosses client and HTTP, verified profile completion enables username login',async()=>{
 const f=setup();const input={...f.evidence,name:'홍길동',username:'Seller_01',password:'secure-example',passwordConfirmation:'secure-example',email:'seller@example.test',phone:'010-1234-5678'};
 assert.equal((await f.client.checkUsername('Seller_01')).code,'available');
 assert.equal((await f.client.register(input)).code,'signup_requested');
 assert.equal([...f.saved.values()].some(v=>v.includes(input.email)||v.includes(input.password)),false);
 assert.equal((await f.client.inspectDraft()).code,'verification_required');
 f.confirm();assert.equal((await f.client.inspectDraft()).code,'draft_ready');
 assert.equal((await f.client.complete(f.evidence)).code,'profile_completed');
 assert.equal(f.saved.size,0);assert.deepEqual(f.profile(),{username:'seller_01',subject:'subject-one',email:'seller@example.test'});
 await f.client.signOut();assert.equal((await f.client.signIn('seller_01','wrong')).code,'sign_in_failed');
 assert.equal((await f.client.signIn('seller_01','secure-example')).code,'signed_in');
});
