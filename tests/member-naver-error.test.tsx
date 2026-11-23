import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemberNaverError} from '../src/components/store/member-naver-error';

test('Naver identity conflict explains existing data and how to inspect the other account',()=>{
  const html=renderToStaticMarkup(<MemberNaverError message="이미 다른 계정에 연결된 네이버 계정입니다." conflict signupRequired={false} basePath="/Kitsnode"/>);
  assert.match(html,/role="alert"/);
  assert.match(html,/다른 데이터가 저장되어 있을 수 있으니/);
  assert.match(html,/로그아웃한 뒤/);
  assert.match(html,/href="\/Kitsnode\/store\/signup\/"/);
  assert.doesNotMatch(html,/삭제|탈퇴/);
});
test('other errors do not show conflict advice and signup-required still links to signup',()=>{
  const common={message:'인증 실패', conflict:false, basePath:'/Kitsnode'};
  assert.doesNotMatch(renderToStaticMarkup(<MemberNaverError {...common} signupRequired={false}/>),/회원가입 화면으로 이동|다른 데이터/);
  assert.match(renderToStaticMarkup(<MemberNaverError {...common} signupRequired/>),/href="\/Kitsnode\/store\/signup\/"/);
});
