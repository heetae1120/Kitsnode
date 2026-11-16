import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('member preview reuses real UI and passes only inert operations', async () => {
  const source = readFileSync(new URL('../src/components/store/member-preview.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createClient|localStorage|fetch\s*\(/);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const Form = Symbol('real-email-form'), Consent = Symbol('real-consent-gate'), Withdraw = Symbol('real-withdraw'), Naver = Symbol('real-naver');
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({type, props}), jsxs: (type: unknown, props: unknown) => ({type, props}) },
    './member-email-auth-form': { EmailAuthForm: Form }, './member-consent-gate': { MemberConsentGate: Consent },
    './member-consent-withdraw': { MemberConsentWithdraw: Withdraw }, './member-naver-sign-in': { MemberNaverSignIn: Naver },
    '@/lib/member-auth-config.mjs': { MEMBER_INTAKE_REVIEWED: true, readMemberAuthConfig: () => ({signup:true, naver:true}), canUseMemberNaver: () => true },
    '@/lib/member-consent.mjs': { MEMBER_TERMS_VERSION:'example', MEMBER_PRIVACY_VERSION:'example' },
  };
  const exports: Record<string, Function> = {};
  new Function('require', 'exports', 'process', code)((id: string) => { assert.ok(id in modules, id); return modules[id]; }, exports, {env:{}});
  type Element = {type: unknown; props: Record<string, any>};
  for (const stage of ['default', 'error', 'verification', 'authenticated'] as const) {
    const wrapper = exports.MemberPreview({mode:'signup', stage}) as Element;
    assert.equal(wrapper.props['data-preview-stage'], stage);
    const section = wrapper.props.children as Element;
    const children = section.props.children as Element[];
    assert.equal(children[0].type, Form);
    assert.equal(children[0].props.initialMode, 'signup');
    assert.equal(children[0].props.signedIn, stage === 'authenticated');
    assert.equal(children[0].props.previewStatus, stage === 'error' || stage === 'verification' ? stage : undefined);
    for (const operation of Object.values(children[0].props.auth) as Array<() => Promise<{ok:boolean}>>) assert.equal((await operation()).ok, false);
    assert.equal((await children[0].props.signupConsent.register()).ok, false);
    if (stage === 'authenticated') assert.equal(children[1].type, Withdraw);
    else assert.equal(children[2].type, Naver);
  }
  const consent = (exports.MemberPreview({mode:'login', stage:'consent'}) as Element).props.children as Element;
  assert.equal(consent.type, Consent);
  assert.equal((await consent.props.accept()).ok, false);
  assert.equal((await consent.props.signOut()).ok, false);
});
