import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {EmailAuthForm, type EmailAuth} from '../src/components/store/member-email-auth-form';

const fn = async () => ({ok:false,code:'disabled'});
const extendedSignup={checkUsername:fn,register:fn};
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
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={true} signupConsent={signupConsent} signupVariant="extended" extendedSignup={extendedSignup}/>);
  assert.match(html,/href="\/Kitsnode\/terms\/"/);
  assert.match(html,/href="\/Kitsnode\/privacy\/"/);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,3);
  for (const label of ['이름','아이디','비밀번호 재확인','휴대폰 번호','만 14세 이상']) assert.ok(html.includes(label));
  assert.match(html,/아이디 중복 확인/);
  assert.doesNotMatch(html,/checked=""/);
  assert.match(html,/disabled="">일반 회원가입<\/button>/);
});
test('invalid notice links keep signup disabled',()=>{
  const signupConsent={terms:{href:'//evil.test/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:async()=>({ok:false,code:'disabled'})};
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup={true} signupConsent={signupConsent} signupVariant="extended" extendedSignup={extendedSignup}/>);
  assert.match(html,/회원가입은 준비 중/);
  assert.doesNotMatch(html,/evil\.test/);
});

test('legacy email-only registration remains available without the new feature',()=>{
  const signupConsent={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:fn};
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup signupConsent={signupConsent}/>);
  assert.doesNotMatch(html,/회원가입은 준비 중/);
  assert.match(html,/이메일 회원가입/);
  assert.equal((html.match(/type="checkbox"/g)||[]).length,2);
  assert.doesNotMatch(html,/아이디 중복 확인/);
});
test('explicit extended mode cannot fall back to legacy registration',()=>{
  const signupConsent={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:fn};
  const html=renderToStaticMarkup(<EmailAuthForm auth={auth} initialMode="signup" allowSignup signupConsent={signupConsent} signupVariant="extended"/>);
  assert.match(html,/회원가입은 준비 중/);
  assert.match(html,/이메일 로그인/);
  assert.doesNotMatch(html,/아이디 중복 확인/);
});
