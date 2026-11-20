import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MEMBER_SELF_DELETION_ENABLED, MemberSelfDeletion, DeletionHelp} from '../src/components/store/member-self-deletion';

test('deletion follows the explicit build flag and starts behind a confirmation step',()=>{
  assert.equal(MEMBER_SELF_DELETION_ENABLED,process.env.NEXT_PUBLIC_MEMBER_DELETION_ENABLED === 'true');
  const html=renderToStaticMarkup(<MemberSelfDeletion remove={async()=>{throw Error('must not run');}} onDeleted={async()=>{}}/>);
  assert.match(html,/회원 탈퇴/);
  assert.doesNotMatch(html,/탈퇴 요청/);
});

test('uncertain outcomes offer contact without claiming the account was deleted or identifying a reason',()=>{
  const html=renderToStaticMarkup(<DeletionHelp status="uncertain"/>);
  assert.match(html,/처리 여부를 확인하지 못했습니다/);
  assert.match(html,/다시 요청하지 말고/);
  assert.match(html,/mailto:/);
  assert.doesNotMatch(html,/직원|광고|Storage|탈퇴가 완료/);
});

test('confirmed blocked deletion explains separate handling without disclosing protected categories',()=>{
  const html=renderToStaticMarkup(<DeletionHelp status="needs_review"/>);
  assert.match(html,/연결된 정보 확인이 필요해 자동 탈퇴를 진행하지 못했습니다/);
  assert.match(html,/mailto:/);
  assert.doesNotMatch(html,/직원|광고|Storage/);
});
