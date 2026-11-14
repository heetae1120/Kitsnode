import test from 'node:test';
import assert from 'node:assert/strict';
import {readMemberAuthConfig,memberRedirect} from '../src/lib/member-auth-config.mjs';
import {createNaverAuth} from '../src/lib/member-naver-auth.mjs';

const ref='abcdefghijklmnopqrst';
const valid={enabled:'true',projectRef:ref,url:`https://${ref}.supabase.co`,key:'sb_publishable_test_key'};
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
