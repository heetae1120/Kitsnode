import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLayoutPatch, getEditableTextNode } from '../src/lib/layout-edits';

// Minimal DOM fixture: exercises node identity without adding a DOM dependency.
type FixtureNode = { nodeType: number; data?: string; parentNode?: unknown };
const text = (data: string): FixtureNode => ({ nodeType: 3, data });
const child = (): FixtureNode => ({ nodeType: 1 });
function element(nodes: FixtureNode[], tagName = 'P', namespaceURI = 'http://www.w3.org/1999/xhtml') {
  const el = {
    tagName, namespaceURI, childNodes: nodes, style: {},
    ownerDocument: { createTextNode: text },
    appendChild(node: FixtureNode) { this.childNodes.push(node); node.parentNode = this; return node; },
  };
  for (const node of nodes) node.parentNode = el;
  return el as unknown as HTMLElement;
}

test('plain text patch edits the existing node and supports erasing and retyping', () => {
  const node = text('원래 문구');
  const el = element([node]);
  assert.equal(getEditableTextNode(el), node);
  applyLayoutPatch(el, { text: '' });
  assert.equal(node.data, '');
  assert.equal(getEditableTextNode(el), node);
  applyLayoutPatch(el, { text: '새 문구' });
  assert.equal(node.data, '새 문구');
});

test('nested heading and icon button keep their child node identities', () => {
  for (const tag of ['H1', 'BUTTON']) {
    const node = text('직접 문구'), markup = child(), otherMarkup = child();
    const el = element([node, markup, otherMarkup], tag);
    const before = [...el.childNodes];
    applyLayoutPatch(el, { text: '<b>plain text</b>' });
    assert.equal(node.data, '<b>plain text</b>');
    assert.deepEqual([...el.childNodes], before);
    assert.equal(el.childNodes[1], markup);
    assert.equal(markup.parentNode, el);
  }
});

test('multiple direct text nodes and child-only containers are not flattened', () => {
  const first = text('before'), last = text('after'), markup = child();
  const el = element([first, markup, last]);
  assert.equal(getEditableTextNode(el), null);
  applyLayoutPatch(el, { text: 'replacement' });
  assert.equal(first.data, 'before');
  assert.equal(last.data, 'after');
  assert.equal(getEditableTextNode(element([child()])), null);
  assert.equal(getEditableTextNode(element([text(' '), child(), text('value')])), null);
});

test('empty safe leaf gets one stable editable text node', () => {
  const el = element([]);
  const node = getEditableTextNode(el);
  assert.ok(node);
  assert.equal(node.data, '');
  assert.equal(getEditableTextNode(el), node);
  applyLayoutPatch(el, { text: 'added' });
  assert.equal(node.data, 'added');
  assert.equal(el.childNodes.length, 1);
});

test('unsafe elements, form inputs and SVG are never text targets', () => {
  for (const tag of ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'TEMPLATE', 'IFRAME', 'IMG', 'BR', 'BODY']) {
    const node = text('unchanged'), el = element([node], tag);
    assert.equal(getEditableTextNode(el), null, tag);
    applyLayoutPatch(el, { text: 'changed' });
    assert.equal(node.data, 'unchanged', tag);
  }
  assert.equal(getEditableTextNode(element([text('icon')], 'text', 'http://www.w3.org/2000/svg')), null);
});

test('helper follows a replacement Text node without mutating detached node', () => {
  const old = text('old'), el = element([old]);
  applyLayoutPatch(el, { text: 'first patch' });
  const replacement = text('React value');
  old.parentNode = null;
  replacement.parentNode = el;
  (el.childNodes as unknown as FixtureNode[]).splice(0, 1, replacement);
  assert.equal(getEditableTextNode(el), replacement);
  applyLayoutPatch(el, { text: 'second patch' });
  assert.equal(replacement.data, 'second patch');
  assert.equal(old.data, 'first patch');
});
