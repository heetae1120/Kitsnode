import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberPreview, type MemberPreviewStage } from '../src/components/store/member-preview';

test('synthetic member states carry exact state marker, no live forms or customer values', () => {
  for (const mode of ['login','signup'] as const) for (const stage of ['default','error','verification','authenticated','consent'] as MemberPreviewStage[]) {
    const html = renderToStaticMarkup(React.createElement(MemberPreview, {mode, stage}));
    assert.match(html, new RegExp(`data-preview-stage="${stage}"`));
    assert.match(html, /예시/);
    assert.doesNotMatch(html, /<form|action=|@example|value="[^"\s]+"/);
    for (const name of ['email-input','password-input','submit-button','naver-button']) {
      assert.equal(html.includes(`data-auth-edit="${name}"`), stage === 'default' || stage === 'error');
    }
  }
});

test('consent preview shows separate inert required documents', () => {
  const html = renderToStaticMarkup(React.createElement(MemberPreview, {mode:'login', stage:'consent'}));
  assert.match(html, /이용약관/);
  assert.match(html, /개인정보 수집·이용 안내/);
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/type="checkbox" disabled/g) || []).length, 2);
  assert.match(html, /실제 문서가 아닌 미리보기/);
});
