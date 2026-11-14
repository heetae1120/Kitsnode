import test from 'node:test';
import assert from 'node:assert/strict';
import {createEmailAuthClient} from '../src/lib/member-email-auth.mjs';

function fixture(overrides = {}) {
  const calls = [];
  let onChange;
  const auth = {
    onAuthStateChange(fn) { onChange=fn; return {data:{subscription:{unsubscribe(){calls.push('unsubscribe');}}}}; },
    async signUp(payload) {calls.push(['signup',payload]);return {data:{user:{id:'synthetic'},session:null},error:null};},
    async signInWithPassword(payload) {calls.push(['signin',payload]);return {data:{user:{email_confirmed_at:'2026-01-01'},session:{synthetic:true}},error:null};},
    async signOut() {calls.push('signout');return {error:null};},
    async resetPasswordForEmail(...args) {calls.push(['reset',...args]);return {data:{},error:null};},
    async updateUser(payload) {calls.push(['update',payload]);return {data:{},error:null};},
    ...overrides,
  };
  const config={auth,confirmationRedirectTo:'http://127.0.0.1:3000/auth/confirm',recoveryRedirectTo:'http://127.0.0.1:3000/auth/recovery',trustedOrigin:'http://127.0.0.1:3000',signupAllowed:true};
  return {auth,config,calls,emit(event){onChange(event,null);},client:createEmailAuthClient(config)};
}

test('rejects redirects to another origin or nonlocal unencrypted host', () => {
  const {config}=fixture();
  assert.throws(()=>createEmailAuthClient({...config,confirmationRedirectTo:'https://evil.example/steal'}),/invalid_auth_configuration/);
  assert.throws(()=>createEmailAuthClient({...config,trustedOrigin:'http://example.com',recoveryRedirectTo:'http://example.com/recovery',confirmationRedirectTo:'http://example.com/confirm'}),/invalid_auth_configuration/);
  assert.throws(()=>createEmailAuthClient({...config,recoveryRedirectTo:'http://127.0.0.1:3000/auth/recovery?next=x'}),/invalid_auth_configuration/);
});

test('signup requests confirmation, with no automatic login',async()=>{
  const {client,calls}=fixture();
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password'),{ok:true,code:'signup_requested'});
  assert.equal(calls[0][1].options.emailRedirectTo,'http://127.0.0.1:3000/auth/confirm');
  assert.deepEqual(await client.signUp('invalid','short'),{ok:false,code:'invalid_input'});
  assert.equal(calls.length,1);
});

test('signup is disabled by default and makes no Auth API request',async()=>{
  const {config,calls}=fixture();
  const client=createEmailAuthClient({...config,signupAllowed:undefined});
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password'),{ok:false,code:'signup_disabled'});
  assert.deepEqual(calls,[]);
  client.dispose();
});

test('signup rejects projects that issue unconfirmed sessions',async()=>{
  const calls=[];const {client}=fixture({async signUp(){return {data:{session:{synthetic:true}},error:null};},async signOut(){calls.push('signout');return {error:null};}});
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password'),{ok:false,code:'confirmation_required'});
  assert.deepEqual(calls,['signout']);
});

test('login rejects unconfirmed or malformed result; logout works',async()=>{
  const {client}=fixture();
  assert.deepEqual(await client.signIn('person@example.test','synthetic-password'),{ok:true,code:'signed_in'});
  assert.deepEqual(await client.signOut(),{ok:true,code:'signed_out'});
  const unconfirmed=fixture({async signInWithPassword(){return {data:{user:{},session:{synthetic:true}},error:null};}});
  assert.deepEqual(await unconfirmed.client.signIn('person@example.test','synthetic-password'),{ok:false,code:'requires_confirmation'});
  assert.ok(unconfirmed.calls.includes('signout'));
});

test('reset request has fixed redirect; password change requires recovery event',async()=>{
  const {client,calls,emit}=fixture();
  assert.deepEqual(await client.requestPasswordReset('person@example.test'),{ok:true,code:'reset_requested'});
  assert.equal(calls[0][2].redirectTo,'http://127.0.0.1:3000/auth/recovery');
  assert.deepEqual(await client.updatePassword('another-password'),{ok:false,code:'recovery_required'});
  emit('PASSWORD_RECOVERY');
  assert.deepEqual(await client.updatePassword('another-password'),{ok:true,code:'password_updated'});
  assert.deepEqual(await client.updatePassword('again-password'),{ok:false,code:'recovery_required'});
});

test('provider errors and exceptions do not leak details or report success',async()=>{
  const {client}=fixture({async signInWithPassword(){throw new Error('secret-details');},async resetPasswordForEmail(){return {error:{message:'private'}};}});
  assert.deepEqual(await client.signIn('person@example.test','password'),{ok:false,code:'unavailable'});
  assert.deepEqual(await client.requestPasswordReset('person@example.test'),{ok:false,code:'unavailable'});
});
