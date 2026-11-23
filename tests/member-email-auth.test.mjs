import test from 'node:test';
import assert from 'node:assert/strict';
import {MEMBER_TERMS_VERSION, MEMBER_PRIVACY_VERSION} from '../src/lib/member-consent.mjs';
const consent={termsVersion:MEMBER_TERMS_VERSION,privacyVersion:MEMBER_PRIVACY_VERSION,termsAccepted:true,privacyAcknowledged:true};
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
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password',consent),{ok:true,code:'signup_requested'});
  assert.equal(calls[0][1].options.emailRedirectTo,'http://127.0.0.1:3000/auth/confirm');
  assert.deepEqual(calls[0][1].options.data.kitsnode_consent,consent);
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password'),{ok:false,code:'invalid_input'});
  assert.deepEqual(await client.signUp('invalid','short'),{ok:false,code:'invalid_input'});
  assert.equal(calls.length,1);
});

test('signup carries validated profile draft without storing the password in metadata',async()=>{
 const {client,calls}=fixture();const draft={username:'seller_one',name:'Synthetic',phone:'01012345678',company:'',ageConfirmed:true};
 assert.deepEqual(await client.signUp('person@example.test','synthetic-password',consent,draft),{ok:true,code:'signup_requested'});
 assert.deepEqual(calls[0][1].options.data.kitsnode_signup_draft,draft);
 assert.equal(JSON.stringify(calls[0][1].options.data).includes('synthetic-password'),false);
 assert.deepEqual(await client.signUp('person@example.test','synthetic-password',consent,{...draft,company:'x'.repeat(101)}),{ok:false,code:'invalid_input'});
 assert.equal(calls.length,1);
});

test('signup is disabled by default and makes no Auth API request',async()=>{
  const {config,calls}=fixture();
  const client=createEmailAuthClient({...config,signupAllowed:undefined});
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password',consent),{ok:false,code:'signup_disabled'});
  assert.deepEqual(calls,[]);
  client.dispose();
});

test('signup rejects projects that issue unconfirmed sessions',async()=>{
  const calls=[];const {client}=fixture({async signUp(){return {data:{session:{synthetic:true}},error:null};},async signOut(){calls.push('signout');return {error:null};}});
  assert.deepEqual(await client.signUp('person@example.test','synthetic-password',consent),{ok:false,code:'confirmation_required'});
  assert.deepEqual(calls,['signout']);
});

test('login rejects unconfirmed or malformed result; logout works',async()=>{
  const {client}=fixture();
  assert.deepEqual(await client.signIn('person@example.test','synthetic-password',consent),{ok:true,code:'signed_in'});
  assert.deepEqual(await client.signOut(),{ok:true,code:'signed_out'});
  const unconfirmed=fixture({async signInWithPassword(){return {data:{user:{},session:{synthetic:true}},error:null};}});
  assert.deepEqual(await unconfirmed.client.signIn('person@example.test','synthetic-password',consent),{ok:false,code:'requires_confirmation'});
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

test('email rate limits produce a safe actionable result', async()=>{
  const limited=fixture({async resetPasswordForEmail(){return {error:{code:'over_email_send_rate_limit'}};},async signUp(){return {error:{code:'over_email_send_rate_limit'}};}});
  assert.deepEqual(await limited.client.requestPasswordReset('person@example.test'),{ok:false,code:'email_rate_limited'});
  assert.deepEqual(await limited.client.signUp('person@example.test','synthetic-password',consent),{ok:false,code:'email_rate_limited'});
});

test('signup code verifies the intended confirmed email and handles incorrect codes',async()=>{
  const {client,calls}=fixture({async verifyOtp(payload){calls.push(['verify',payload]);return {data:{user:{email:'person@example.test',email_confirmed_at:'2026-01-01'},session:{synthetic:true}},error:null};}});
  assert.deepEqual(await client.verifySignupCode('person@example.test','123456'),{ok:true,code:'email_verified'});
  assert.deepEqual(calls[0],['verify',{email:'person@example.test',token:'123456',type:'email'}]);
  assert.deepEqual(await client.verifySignupCode('person@example.test','oops'),{ok:false,code:'invalid_code'});
  const bad=fixture({async verifyOtp(){return {error:{code:'otp_expired'},data:null};}});
  assert.deepEqual(await bad.client.verifySignupCode('person@example.test','123456'),{ok:false,code:'invalid_code'});
});

test('signup resend is gated, limited and never reports failure details',async()=>{
  const {client,calls}=fixture({async resend(payload){calls.push(['resend',payload]);return {error:null};}});
  assert.deepEqual(await client.resendSignupCode('person@example.test'),{ok:true,code:'signup_code_resent'});
  assert.deepEqual(calls[0],['resend',{email:'person@example.test',type:'signup'}]);
  const limited=fixture({async resend(){return {error:{code:'over_email_send_rate_limit'}};}});
  assert.deepEqual(await limited.client.resendSignupCode('person@example.test'),{ok:false,code:'email_rate_limited'});
  const disabled=createEmailAuthClient({...fixture().config,signupAllowed:false});
  assert.deepEqual(await disabled.resendSignupCode('person@example.test'),{ok:false,code:'signup_disabled'});
});

test('signup verification discards a session for the wrong or unconfirmed email',async()=>{
  const {client,calls}=fixture({async verifyOtp(){return {data:{user:{email:'other@example.test',email_confirmed_at:'2026-01-01'},session:{synthetic:true}},error:null};}});
  assert.deepEqual(await client.verifySignupCode('person@example.test','123456'),{ok:false,code:'invalid_code'});
  assert.ok(calls.includes('signout'));
});
