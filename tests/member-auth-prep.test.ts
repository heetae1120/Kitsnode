import test from 'node:test';
import assert from 'node:assert/strict';
import {canUseMemberNaver,readMemberAuthConfig,memberRedirect} from '../src/lib/member-auth-config.mjs';
import {createNaverAuth, naverIdentityState, oauthCallbackError} from '../src/lib/member-naver-auth.mjs';

const ref='abcdefghijklmnopqrst';
const valid={enabled:'true',projectRef:ref,url:`https://${ref}.supabase.co`,key:'sb_publishable_test_key'};
test('naver login cannot be turned on when the consent gate is disabled',()=>{
  assert.equal(canUseMemberNaver(null),false);
  assert.equal(canUseMemberNaver({signup:false,naver:true}),false);
  assert.equal(canUseMemberNaver({signup:true,naver:false}),false);
  assert.equal(canUseMemberNaver({signup:true,naver:true}),true);
});
test('hosted auth is off by default and validates exact project origin and public key',()=>{
  assert.equal(readMemberAuthConfig({...valid,enabled:undefined}),null);
  for(const invalid of [
    {...valid,url:`https://${ref}.supabase.co.attacker.example`},
    {...valid,url:`http://${ref}.supabase.co`},
    {...valid,url:`https://${ref}.supabase.co/path`},
    {...valid,key:'sb_secret_exposed'},
    {...valid,projectRef:'short'},
  ]) assert.equal(readMemberAuthConfig(invalid),null);
  assert.deepEqual(readMemberAuthConfig(valid),{url:valid.url,key:valid.key,signup:false,naver:false,link:false});
});
test('legacy JWT service role and wrong project keys are not accepted',()=>{
  const jwt=(role:string,project:string)=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role,ref:project})).toString('base64url')}.signature`;
  assert.equal(readMemberAuthConfig({...valid,key:jwt('service_role',ref)}),null);
  assert.equal(readMemberAuthConfig({...valid,key:jwt('anon','zyxwvutsrqponmlkjihg')}),null);
  assert.ok(readMemberAuthConfig({...valid,key:jwt('anon',ref)}));
});
test('naver linking requires verified user and explicit action',async()=>{
  const events:string[]=[];
  let user=false;
  const auth:any={getUser:async()=>({data:{user:user?{id:'synthetic',email_confirmed_at:'2026-01-01T00:00:00Z',identities:[{provider:'email'}]}:null},error:null}),linkIdentity:async()=>{events.push('link');return {error:null}},signInWithOAuth:async()=>{events.push('signIn');return {error:null}}};
  const social=createNaverAuth({auth,trustedOrigin:'https://example.test',redirectTo:'https://example.test/Kitsnode/store/login/',allowSignIn:false,allowLink:true});
  assert.equal((await social.signIn()).code,'disabled');
  assert.equal((await social.link()).code,'unauthenticated');
  assert.deepEqual(events,[]);
  user=true;
  assert.equal((await social.link()).code,'redirecting');
  assert.deepEqual(events,['link']);
});
test('linking rejects users without a confirmed email identity',async()=>{
  let called=false;
  for(const account of [{id:'a',email_confirmed_at:null,identities:[{provider:'email'}]}, {id:'a',email_confirmed_at:'2026',identities:[{provider:'custom:naver'}]}]) {
    const auth:any={getUser:async()=>({data:{user:account},error:null}),linkIdentity:async()=>{called=true;return {error:null}}};
    const social=createNaverAuth({auth,trustedOrigin:'https://example.test',redirectTo:'https://example.test/login/',allowSignIn:false,allowLink:true});
    assert.equal((await social.link()).code,'unauthenticated');
  }
  assert.equal(called,false);
});
test('naver login uses the custom provider and approved callback',async()=>{
  let received:any=null;
  const auth:any={signInWithOAuth:async (options:any)=>{received=options;return {error:null}}};
  const social=createNaverAuth({auth,trustedOrigin:'https://example.test',redirectTo:'https://example.test/Kitsnode/store/login/',allowSignIn:true,allowLink:false});
  assert.equal((await social.signIn()).code,'redirecting');
  assert.deepEqual(received,{provider:'custom:naver',options:{redirectTo:'https://example.test/Kitsnode/store/login/'}});
  assert.equal((await social.link()).code,'disabled');
});
test('link status distinguishes a verified email user and a naver-only user',()=>{
  assert.deepEqual(naverIdentityState(null),{linked:false,canLinkEmail:false});
  assert.deepEqual(naverIdentityState({id:'user',email_confirmed_at:null,identities:[{provider:'email'}]}),{linked:false,canLinkEmail:false});
  assert.deepEqual(naverIdentityState({id:'user',email_confirmed_at:'2026',identities:[{provider:'email'}]}),{linked:false,canLinkEmail:true});
  assert.deepEqual(naverIdentityState({id:'user',email_confirmed_at:null,identities:[{provider:'custom:naver'}]}),{linked:true,canLinkEmail:false});
  assert.deepEqual(naverIdentityState({id:'user',email_confirmed_at:'2026',identities:[{provider:'email'},{provider:'custom:naver'}]}),{linked:true,canLinkEmail:true});
});
test('linking an already connected identity does not start a second linking flow',async()=>{
  let calls=0;
  const auth:any={getUser:async()=>({data:{user:{id:'user',email_confirmed_at:'2026',identities:[{provider:'email'},{provider:'custom:naver'}]}},error:null}),linkIdentity:async()=>{calls++;return {error:null}}};
  const social=createNaverAuth({auth,trustedOrigin:'https://example.test',redirectTo:'https://example.test/login/',allowSignIn:false,allowLink:true});
  assert.equal((await social.link()).code,'already_linked');
  assert.equal(calls,0);
});
test('oauth callback reports known errors without exposing remote text or consuming valid tokens',()=>{
  assert.equal(oauthCallbackError('https://example.test/login/#error=access_denied&error_description=private'), 'cancelled');
  assert.equal(oauthCallbackError('https://example.test/login/#error=server_error&error_code=identity_already_exists'), 'identity_conflict');
  assert.equal(oauthCallbackError('https://example.test/login/?error=server_error&error_description=private'), 'unavailable');
  assert.equal(oauthCallbackError('https://example.test/login/#access_token=synthetic&error=access_denied'), null);
  assert.equal(oauthCallbackError('https://example.test/login/?code=synthetic&error=access_denied'), null);
  assert.equal(oauthCallbackError('https://example.test/login/'), null);
});
test('social redirects reject cross origin, tokens and insecure scheme',()=>{
  for(const url of ['https://evil.test/login','https://example.test/login?token=x','http://example.test/login']) {
    assert.throws(()=>createNaverAuth({auth:{} as any,trustedOrigin:'https://example.test',redirectTo:url,allowLink:true,allowSignIn:false}));
  }
});
test('authentication callback uses only HTTPS origin and canonical static base path',()=>{
  assert.equal(memberRedirect('https://example.test','/Kitsnode'),'https://example.test/Kitsnode/store/login/');
  assert.equal(memberRedirect('https://example.test'),'https://example.test/store/login/');
  for(const base of ['//evil','/a/../b','/x?redirect=evil','/%2F%2Fevil']) assert.equal(memberRedirect('https://example.test',base),null);
  assert.equal(memberRedirect('http://example.test','/Kitsnode'),null);
  assert.equal(memberRedirect('https://example.test/path','/Kitsnode'),null);
});
