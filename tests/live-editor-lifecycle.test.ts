import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as preview from '../src/lib/layout-preview';
import * as protocol from '../src/lib/live-editor-protocol';

test('untrusted frames cannot initialize live editor and writes are blocked before handshake', async () => {
  const source = readFileSync(new URL('../src/components/live-editor-bridge.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const session = 'a'.repeat(32), parentMessages: { origin: string; message: Record<string, unknown> }[] = [];
  const parent = { postMessage: (message: Record<string, unknown>, origin: string) => parentMessages.push({ origin, message }) };
  const callbacks = new Map<string, Function>();
  const originalFetch = async () => new Response('unexpected');
  const win = { parent, location: { search: `?kits_live_editor=1&session=${session}`, pathname: '/tools/' }, fetch: originalFetch,
    addEventListener: (type: string, callback: Function) => callbacks.set(type, callback), removeEventListener: (type: string) => callbacks.delete(type),
    setTimeout: () => 1, clearTimeout: () => {} };
  const statuses: string[] = []; let effect: () => () => void = () => () => {}; let applies = 0; let draft: ((value: string) => void) | undefined;
  const applier = { apply: () => { applies++; }, dispose() {}, remember() {} };
  class ElementStub {
    tagName = 'SPAN'; className = ''; children: ElementStub[] = []; parentElement: ElementStub | null = null;
    style = { position: '', left: '', top: '' }; ownerDocument: unknown;
    closest() { return null; } querySelector() { return null; } getAttribute() { return null; }
    setAttribute() {} removeAttribute() {} contains(other: unknown) { return other === this; }
    matches() { return false; } getClientRects() { return [1]; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 20, bottom: 10, width: 20, height: 10 }; }
  }
  const body = new ElementStub(), wrapper = new ElementStub(), target = new ElementStub();
  wrapper.tagName = 'DIV'; body.children = [wrapper]; wrapper.parentElement = body; wrapper.children = [target]; target.parentElement = wrapper;
  const injectedStyles: { textContent: string }[] = [];
  const doc = { body, head: { appendChild(style: { textContent: string }) { injectedStyles.push(style); } }, documentElement: { style: { setProperty() {}, removeProperty() {} } },
    createElement: () => ({ textContent: '', remove() {} }), querySelector: () => null,
    querySelectorAll: (selector: string) => selector === 'body > div:nth-of-type(1) > span:nth-of-type(1)' ? [target] : selector === 'body > div:nth-of-type(1)' ? [wrapper] : [] };
  target.ownerDocument = doc; wrapper.ownerDocument = doc;
  class Observer { observe() {} disconnect() {} }
  class Xhr { open() {} send() {} }
  const beacon = () => true, nav = { sendBeacon: beacon };
  const globals: Record<string, unknown> = { window: win, document: doc, navigator: nav, MutationObserver: Observer, XMLHttpRequest: Xhr, Element: ElementStub, HTMLElement: ElementStub };
  const old = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const modules: Record<string, unknown> = {
    react: { useLayoutEffect: (fn: typeof effect) => { effect = fn; }, useState: () => ['', (s: string) => statuses.push(s)] },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
    '@/lib/editor-layout-applier': { createEditorLayoutApplier: () => applier },
    '@/lib/layout-edits': { getEditableTextNode: () => ({}), isAuthLayoutPage: () => false },
    '@/lib/layout-preview': { ...preview, previewOrigins: () => ['https://editor.example.test'], detectPreviewStage: () => '1' },
    '@/lib/draft-preview-stage': { setDraftPreviewStage() {} },
    '@/lib/live-inline-text-editor': { beginInlineText: (element: ElementStub, commit: (value: string) => void, end: (cancelled: boolean) => void, onDraft: (value: string) => void) => { draft = onDraft; return { element, finish(cancel = false) { if (!cancel) commit('flush value'); end(cancel); } }; }, applyAuthoritativeSnapshot: (session: { finish: (cancel: boolean) => void } | null, apply: () => void) => { session?.finish(true); apply(); } },
    '@/lib/live-editor-protocol': protocol,
  };
  try {
    const exports: Record<string, Function> = {};
    new Function('require', 'exports', 'process', code)((id: string) => { assert.ok(id in modules, id); return modules[id]; }, exports, { env: {} });
    exports.LiveEditorBridge(); const cleanup = effect();
    assert.notEqual(win.fetch, originalFetch);
    await assert.rejects(win.fetch());
    assert.equal(nav.sendBeacon(), false);
    assert.throws(() => new Xhr().send());
    assert.deepEqual(parentMessages.map(x => [x.origin, x.message.type]), [['https://editor.example.test', 'ready']]);
    const init = { protocol: protocol.LIVE_EDITOR_PROTOCOL, session, type: 'init', page: '/tools/', scope: 'page', stage: '1', changes: { '/tools/': {} } };
    const receive = callbacks.get('message')!;
    receive({ origin: 'https://evil.test', source: parent, data: init });
    receive({ origin: 'https://editor.example.test', source: {}, data: init });
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, session: 'b'.repeat(32) } });
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, page: '/other/' } });
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, stage: 'survey-1' } });
    assert.equal(applies, 0);
    receive({ origin: 'https://editor.example.test', source: parent, data: init });
    assert.equal(applies, 1);
    assert.ok(injectedStyles.every(style => !/display\s*:\s*none|position\s*:\s*relative/i.test(style.textContent)), 'editor scope must not hide or reposition visitor content');
    assert.ok(parentMessages.some(x => x.message.type === 'applied' && x.origin === 'https://editor.example.test'));
    const pointer = (x: number, y: number, type = 'pointermove') => ({ type, target, button: 0, clientX: x, clientY: y, preventDefault() {}, stopImmediatePropagation() {} });
    callbacks.get('click')!(pointer(10, 10, 'click'));
    callbacks.get('pointerdown')!(pointer(10, 10, 'pointerdown'));
    callbacks.get('pointermove')!(pointer(40, 30));
    callbacks.get('pointerup')!(pointer(40, 30, 'pointerup'));
    assert.deepEqual(parentMessages.filter(x => x.message.type === 'commit').at(-1)?.message.patch, { left: '30px', top: '20px' });
    assert.equal(target.style.position, 'relative');
    receive({ origin: 'https://evil.test', source: parent, data: { ...init, type: 'select-parent' } });
    assert.notEqual(parentMessages.filter(x => x.message.type === 'selected').at(-1)?.message.selector, 'body > div:nth-of-type(1)');
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, type: 'select-parent' } });
    assert.equal(parentMessages.filter(x => x.message.type === 'selected').at(-1)?.message.selector, 'body > div:nth-of-type(1)');
    assert.equal(parentMessages.filter(x => x.message.type === 'selected').at(-1)?.message.openInspector, true);
    callbacks.get('dblclick')!(pointer(10, 10, 'dblclick'));
    assert.deepEqual({ type: parentMessages.at(-1)?.message.type, active: parentMessages.at(-1)?.message.active }, { type: 'inline-state', active: true });
    draft?.('test draft');
    assert.equal(parentMessages.at(-1)?.message.type, 'inline-draft');
    assert.equal(parentMessages.at(-1)?.message.text, 'test draft');
    const beforeFlush = parentMessages.length;
    receive({ origin: 'https://evil.test', source: parent, data: { ...init, type: 'flush', requestId: 'request-1' } });
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, type: 'flush', requestId: 'invalid!' } });
    assert.equal(parentMessages.length, beforeFlush);
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, type: 'flush', requestId: 'request-1' } });
    assert.deepEqual(parentMessages.slice(beforeFlush).map(x => x.message.type), ['commit', 'inline-state', 'flushed']);
    assert.equal(parentMessages[beforeFlush + 1]?.message.active, false);
    assert.equal(parentMessages[beforeFlush + 1]?.message.cancelled, false);
    assert.equal(parentMessages.at(-1)?.message.requestId, 'request-1');
    callbacks.get('dblclick')!(pointer(10, 10, 'dblclick'));
    receive({ origin: 'https://editor.example.test', source: parent, data: { ...init, type: 'apply' } });
    assert.equal(parentMessages.filter(x => x.message.type === 'inline-state').at(-1)?.message.cancelled, true);
    cleanup();
    assert.equal(win.fetch, originalFetch);
    assert.equal(nav.sendBeacon, beacon);
  } finally {
    for (const key of Object.keys(globals)) { const descriptor = old[key]; if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
