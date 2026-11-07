import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorLayoutApplier } from '../src/lib/editor-layout-applier';
import type { LayoutChanges } from '../src/lib/layout-edits';

function fixture(original = 'original') {
  let mutations = 0, data = original;
  const values = new Map<string, { value: string; priority: string }>();
  const node = { nodeType: 3, parentNode: null as unknown, get data() { return data; }, set data(value: string) { data = value; mutations++; } };
  const style = {
    getPropertyValue(key: string) { return values.get(key)?.value || ''; },
    getPropertyPriority(key: string) { return values.get(key)?.priority || ''; },
    setProperty(key: string, value: string, priority = '') { values.set(key, { value: value === '#fff' ? 'rgb(255, 255, 255)' : value, priority }); mutations++; },
    removeProperty(key: string) { values.delete(key); mutations++; },
  };
  const el = { namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'P', childNodes: [node], style } as unknown as HTMLElement;
  node.parentNode = el;
  return { el, node, style, mutations: () => mutations };
}
const changes = (patch: Record<string, unknown>): LayoutChanges => ({ '/tools/': { 'body:has(.stage1) p': patch } });
function setup() {
  const first = fixture();
  let target: HTMLElement | null = first.el;
  const doc = { querySelector: () => target } as unknown as Document;
  return { ...first, applier: createEditorLayoutApplier(doc, '/tools/'), target: (el: HTMLElement | null) => { target = el; } };
}

test('stage selector no longer matching restores retained header text', () => {
  const f = setup();
  f.applier.apply(changes({ text: 'edited' }));
  assert.equal(f.node.data, 'edited');
  f.target(null);
  f.applier.apply(changes({ text: 'edited' }));
  assert.equal(f.node.data, 'original');
});

test('changed and removed patches restore the original, including erased text', () => {
  const f = setup();
  f.applier.apply(changes({ text: 'one' }));
  f.applier.apply(changes({ text: '' }));
  assert.equal(f.node.data, '');
  f.applier.apply({});
  assert.equal(f.node.data, 'original');
});

test('hidden and positioned patches restore previous inline styles and priority', () => {
  const f = setup();
  f.style.setProperty('display', 'flex', 'important');
  f.applier.apply(changes({ hidden: true, left: '3px' }));
  assert.equal(f.style.getPropertyValue('display'), 'none');
  f.applier.dispose();
  assert.equal(f.style.getPropertyValue('display'), 'flex');
  assert.equal(f.style.getPropertyPriority('display'), 'important');
  assert.equal(f.style.getPropertyValue('position'), '');
  assert.equal(f.style.getPropertyValue('left'), '');
});

test('dynamic target restores old element and captures new element independently', () => {
  const f = setup(), next = fixture('next original');
  f.applier.apply(changes({ text: 'patched' }));
  f.target(next.el);
  f.applier.apply(changes({ text: 'patched' }));
  assert.equal(f.node.data, 'original');
  assert.equal(next.node.data, 'patched');
  f.applier.dispose();
  assert.equal(next.node.data, 'next original');
});

test('identical patches do not mutate again even when CSS serializes differently', () => {
  const f = setup();
  const patch = changes({ text: 'patched', color: '#fff', hidden: true });
  f.applier.apply(patch);
  const count = f.mutations();
  f.applier.apply(patch);
  f.applier.apply(patch);
  assert.equal(f.mutations(), count);
});

test('restore never overwrites newer React state and recaptures live updates', () => {
  const f = setup();
  f.applier.apply(changes({ text: 'patched', color: 'red' }));
  f.node.data = 'React update';
  f.style.setProperty('color', 'blue');
  f.applier.apply({});
  assert.equal(f.node.data, 'React update');
  assert.equal(f.style.getPropertyValue('color'), 'blue');
  f.applier.apply(changes({ text: 'patched' }));
  f.node.data = 'new React update';
  f.applier.apply(changes({ text: 'patched' }));
  f.applier.dispose();
  assert.equal(f.node.data, 'new React update');
});


test('inline commit before apply preserves original baseline across subsequent stage exit', () => {
  const f = setup();
  f.applier.apply(changes({ text: 'first', color: 'red' }));
  f.node.data = 'inline second';
  f.applier.apply(changes({ text: 'inline second', color: 'blue' }));
  assert.equal(f.style.getPropertyValue('color'), 'blue');
  f.target(null);
  f.applier.apply(changes({ text: 'inline second', color: 'blue' }));
  assert.equal(f.node.data, 'original');
  assert.equal(f.style.getPropertyValue('color'), '');
});


test('remember captures first inline and drag originals before DOM mutations', () => {
  const f = setup();
  f.applier.remember(f.el);
  f.node.data = 'first inline';
  f.style.setProperty('left', '10px');
  f.style.setProperty('position', 'relative');
  f.applier.apply(changes({ text: 'first inline', left: '10px' }));
  f.applier.apply({});
  assert.equal(f.node.data, 'original');
  assert.equal(f.style.getPropertyValue('left'), '');
  assert.equal(f.style.getPropertyValue('position'), '');
});

test('remember never restores a detached text node over its replacement', () => {
  const f = setup();
  f.applier.remember(f.el);
  const replacement = { nodeType: 3, parentNode: f.el, data: 'React replacement' };
  f.node.parentNode = null;
  (f.el.childNodes as unknown as object[]).splice(0, 1, replacement);
  f.applier.apply(changes({ text: 'patch' }));
  f.applier.dispose();
  assert.equal(replacement.data, 'React replacement');
});


test('remember captures newly edited fields on an already patched element', () => {
  const f = setup();
  f.applier.apply(changes({ text: 'patched' }));
  f.applier.remember(f.el);
  f.style.setProperty('color', 'red');
  f.applier.apply(changes({ text: 'patched', color: 'red' }));
  f.applier.apply({});
  assert.equal(f.style.getPropertyValue('color'), '');
  assert.equal(f.node.data, 'original');
  f.applier.apply(changes({ color: 'blue' }));
  f.applier.remember(f.el);
  f.node.data = 'first text';
  f.applier.apply(changes({ color: 'blue', text: 'first text' }));
  f.applier.dispose();
  assert.equal(f.node.data, 'original');
  assert.equal(f.style.getPropertyValue('color'), '');
});
