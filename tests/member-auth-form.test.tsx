import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EmailAuthForm, type EmailAuth} from '../src/components/store/member-email-auth-form';

const fn = async () => ({ok:false,code:'disabled'});
const auth:EmailAuth = {signUp:fn,signIn:fn,signOut:fn,requestPasswordReset:fn,updatePassword:fn};
test('signup screen does not offer signup when consent workflow is not ready',()=>{
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={false}/>);
  assert.match(html,/회원가입은 준비 중/);
  assert.doesNotMatch(html,/>회원가입<\/button>/);
  assert.match(html,/이메일 로그인/);
});
test('a signup flag alone cannot bypass missing consent workflow',()=>{
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={true}/>);
  assert.match(html,/회원가입은 준비 중/);
  assert.doesNotMatch(html,/>회원가입<\/button>/);
});
test('ready consent interface renders separate unchecked required acknowledgements',()=>{
  const signupConsent={terms:{href:'/Kitsnode/terms/',version:'v1'},privacy:{href:'/Kitsnode/privacy/',version:'v1'},register:async()=>({ok:false,code:'disabled'})};
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={true} signupConsent={signupConsent}/>);
  assert.match(html,/href="\/Kitsnode\/terms\/"/);
  assert.match(html,/href="\/Kitsnode\/privacy\/"/);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,2);
  assert.doesNotMatch(html,/checked=""/);
  assert.match(html,/disabled="">이메일 회원가입<\/button>/);
});
test('invalid notice links keep signup disabled',()=>{
  const signupConsent={terms:{href:'//evil.test/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:async()=>({ok:false,code:'disabled'})};
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={true} signupConsent={signupConsent}/>);
  assert.match(html,/회원가입은 준비 중/);
  assert.doesNotMatch(html,/evil\.test/);
});
