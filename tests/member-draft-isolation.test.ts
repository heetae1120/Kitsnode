import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('member draft preview never mounts the authentication client', () => {
  const source = readFileSync(new URL('../src/components/store/member-account-entry.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let state: boolean | null = null, effect: () => void = () => {}, authMounts = 0;
  const Preview = () => null;
  const Auth = () => { authMounts++; throw new Error('Authentication must not run'); };
  const modules: Record<string, unknown> = {
    react: { useState: () => [state, (value: boolean) => { state = value; }], useEffect: (fn: () => void) => { effect = fn; } },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({type, props}) },
    'next/dynamic': { __esModule: true, default: () => Auth },
    '@/lib/draft-preview-stage': { isDraftPreviewMode: () => true, useDraftPreviewStage: () => 'error' },
    './member-preview': { MemberPreview: Preview },
  };
  const exports: Record<string, Function> = {};
  new Function('require', 'exports', 'process', code)((id: string) => { assert.ok(id in modules, id); return modules[id]; }, exports, {env: {NEXT_PUBLIC_MEMBER_AUTH_ENABLED:'true'}});
  for (const mode of ['login', 'signup']) {
    state = null;
    assert.equal(exports.MemberAccountEntry({mode, children:null}), null);
    effect();
    const output = exports.MemberAccountEntry({mode, children:null}) as {type: unknown; props: {stage: string}};
    assert.equal(output.type, Preview);
    assert.equal(output.props.stage, 'error');
    assert.equal(authMounts, 0);
  }
});

test('disabled auth default preview reuses the visitor preparation card without mounting auth', () => {
  const source = readFileSync(new URL('../src/components/store/member-account-entry.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const visitorCard = { visitor: 'preparation card' };
  const modules: Record<string, unknown> = {
    react: { useState: () => [true, () => {}], useEffect: () => {} },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    'next/dynamic': { __esModule: true, default: () => () => { throw new Error('Unexpected authentication client'); } },
    '@/lib/draft-preview-stage': { isDraftPreviewMode: () => true, useDraftPreviewStage: () => 'default' },
    './member-preview': { MemberPreview: () => { throw new Error('Unexpected separate preview'); } },
  };
  const exports: Record<string, Function> = {};
  new Function('require', 'exports', 'process', code)((id: string) => { assert.ok(id in modules, id); return modules[id]; }, exports, { env: {} });
  for (const mode of ['login', 'signup']) {
    const output = exports.MemberAccountEntry({ mode, children: visitorCard }) as { type: unknown; props: { children: unknown; 'data-preview-stage': string } };
    assert.equal(output.type, 'div');
    assert.equal(output.props.children, visitorCard);
    assert.equal(output.props['data-preview-stage'], 'default');
  }
});
