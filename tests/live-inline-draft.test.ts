import test from 'node:test';
import assert from 'node:assert/strict';
import { beginInlineText } from '../src/lib/live-inline-text-editor';

test('paste, newline and inputless DOM changes update recovery once and stop on finish', () => {
  let notifyMutation: () => void = () => {}; let disconnected = false;
  const previous = globalThis.MutationObserver;
  class Observer { constructor(callback: () => void) { notifyMutation = callback; } observe() {} disconnect() { disconnected = true; } }
  globalThis.MutationObserver = Observer as unknown as typeof MutationObserver;
  try {
    const events = new Map<string, (event: any) => void>();
    const drafts: string[] = []; let cancelled: boolean | undefined;
    const text = { nodeType: 3, data: 'A', parentNode: null as unknown, replaceWith(replacement: any) { replacement.parentNode = el; } };
    const editor: any = { parentNode: null, style: {}, setAttribute() {}, appendChild(node: any) { node.parentNode = editor; }, addEventListener(type: string, handler: (event: any) => void) { events.set(type, handler); }, contains: () => true, focus() {}, replaceWith(node: any) { node.parentNode = el; editor.parentNode = null; } };
    Object.defineProperty(editor, 'textContent', { get: () => text.data, set: (value) => { text.data = value; } });
    const range = { commonAncestorContainer: editor, deleteContents() {}, insertNode(node: { data: string }) { text.data += node.data; }, setStart() {}, collapse() {}, selectNodeContents() {} };
    const selection = { rangeCount: 1, getRangeAt: () => range, removeAllRanges() {}, addRange() {} };
    const doc = { createElement: () => editor, createTextNode: (data: string) => ({ data, length: data.length }), createRange: () => range, getSelection: () => selection };
    const el: any = { ownerDocument: doc, namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'SPAN', childNodes: [text], isConnected: true };
    text.parentNode = el;
    const session = beginInlineText(el, () => {}, value => { cancelled = value; }, value => drafts.push(value));
    assert.ok(session);
    events.get('paste')!({ preventDefault() {}, clipboardData: { getData: () => 'paste' } });
    assert.deepEqual(drafts, ['Apaste']);
    events.get('keydown')!({ stopPropagation() {}, preventDefault() {}, key: 'Enter', shiftKey: true });
    assert.deepEqual(drafts, ['Apaste', 'Apaste\n']);
    notifyMutation(); events.get('input')!({});
    assert.equal(drafts.length, 2);
    text.data = 'programmatic'; notifyMutation();
    assert.equal(drafts.at(-1), 'programmatic');
    session.finish(true); assert.equal(cancelled, true); assert.equal(disconnected, true);
    text.data = 'after finish'; notifyMutation(); assert.equal(drafts.at(-1), 'programmatic');
  } finally { globalThis.MutationObserver = previous; }
});
