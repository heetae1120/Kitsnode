import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the real component/effect with isolated browser doubles: no network or real DOM.
function mount(valid = true) {
  const source = readFileSync(new URL('../src/components/draft-preview.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const states: string[] = [], timers: Array<() => void> = [];
  const listeners = new Map<string, Function>();
  let effect: Function = () => {};
  const opener = { postMessage() {} };
  const win = { location: { search: '?kits_preview=1&kits_preview_session=test', pathname: '/tools/start/' }, opener,
    fetch: () => { throw new Error('Live network forbidden'); },
    addEventListener: (name: string, cb: Function) => listeners.set(name, cb),
    removeEventListener: (name: string) => listeners.delete(name),
    setTimeout: (cb: () => void) => { timers.push(cb); return timers.length; }, clearTimeout() {} };
  class XHR { open() {} send() {} }
  class Observer { observe() {} disconnect() {} }
  const originalFetch = win.fetch;
  const modules: Record<string, unknown> = {
    react: { useState: () => ['', (value: string) => states.push(value)], useLayoutEffect: (fn: Function) => { effect = fn; } },
    'react/jsx-runtime': { jsx() {} },
    '@/lib/layout-edits': { applyPageLayout() {} },
    '@/lib/draft-preview-stage': { setDraftPreviewStage() {} },
    '@/lib/layout-preview': { PREVIEW_PROTOCOL: 'test', PREVIEW_PAGES: ['/tools/start/'], isPreviewSession: () => valid,
      previewOrigins: () => ['https://editor.example'], isPreviewMessage: (data: {type: string}, _session: string, type: string) => data.type === type,
      validPreviewSnapshot: () => true, validPreviewStage: () => true, detectPreviewStage() {} },
  };
  const exports: Record<string, Function> = {};
  new Function('require', 'exports', 'window', 'document', 'navigator', 'XMLHttpRequest', 'MutationObserver', 'process', code)(
    (id: string) => { assert.ok(id in modules, id); return modules[id]; }, exports, win, { body: {} }, { sendBeacon() {} }, XHR, Observer, { env: {} });
  exports.DraftPreview();
  const cleanup = effect();
  return { states, tick: () => timers.forEach(cb => cb()), cancel: () => listeners.get('message')?.({ source: opener, origin: 'https://editor.example', data: { type: 'cancel' } }),
    cleanup, restored: () => win.fetch === originalFetch };
}
test('cancelled preview keeps its terminal message after connection deadline', () => {
  const view = mount(); view.cancel(); const expected = view.states.at(-1); assert.match(expected!, /종료/);
  view.tick(); assert.equal(view.states.at(-1), expected); view.cleanup(); assert.ok(view.restored());
});
test('invalid preview keeps its validation message after connection deadline', () => {
  const view = mount(false); const expected = view.states.at(-1); assert.match(expected!, /유효하지/);
  view.tick(); assert.equal(view.states.at(-1), expected); view.cleanup();
});
test('active unconnected preview still reports timeout', () => {
  const view = mount(); view.tick(); assert.match(view.states.at(-1)!, /연결하지 못/); view.cleanup();
});
test('unmounted preview ignores an already queued timeout', () => {
  const view = mount(); view.cleanup(); const count = view.states.length; view.tick(); assert.equal(view.states.length, count);
});
