import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPageLayout, isCommonLayoutSelector, orderedLayoutEntries, type LayoutChanges } from '../src/lib/layout-edits';
import { createEditorLayoutApplier } from '../src/lib/editor-layout-applier';

function fixture() {
  const values = new Map<string, string>([['display', 'flex']]);
  const style = new Proxy({
    getPropertyValue(key: string) { return values.get(key) || ''; },
    getPropertyPriority() { return ''; },
    setProperty(key: string, value: string) { values.set(key, value); },
    removeProperty(key: string) { values.delete(key); },
  }, {
    get(target, key) { return key in target ? Reflect.get(target, key) : values.get(String(key)) || ''; },
    set(_target, key, value) { values.set(String(key), value); return true; },
  });
  const node = { nodeType: 3, data: 'original', parentNode: null as unknown };
  const el = { namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'SPAN', childNodes: [node], style } as unknown as HTMLElement;
  node.parentNode = el;
  const doc = { querySelector(selector: string) { if (selector === 'body invalid[') throw new Error('invalid'); return selector === 'body .missing' ? null : el; } } as unknown as Document;
  return { doc, el, node, values };
}

test('common selector boundary is exact and legacy order is retained', () => {
  for (const prefix of ['body .tool-topbar', 'body .mp-live-bar']) {
    assert.equal(isCommonLayoutSelector(prefix), true);
    assert.equal(isCommonLayoutSelector(`${prefix} > span:nth-of-type(1)`), true);
    for (const suffix of ['-other', ' span', ':hover', '> span', ', main']) assert.equal(isCommonLayoutSelector(prefix + suffix), false);
  }
  assert.deepEqual(orderedLayoutEntries({ 'body .tool-topbar': {}, 'body z': {}, 'body a': {} }).map(([selector]) => selector), ['body z', 'body a', 'body .tool-topbar']);
});

for (const common of ['body .tool-topbar > span:nth-of-type(1)', 'body .mp-live-bar > span:nth-of-type(1)']) {
  for (const reversed of [false, true]) {
    for (const kind of ['page', 'tracked'] as const) {
      test(`${kind}: common overrides legacy regardless of key order (${common}, reversed=${reversed})`, () => {
        const f = fixture();
        const entries: [string, Record<string, string | boolean>][] = [
          ['body > div:nth-of-type(1) > span:nth-of-type(1)', { text: 'legacy', color: 'red', hidden: true }],
          [common, { text: '', color: 'blue', hidden: false }],
          ['body invalid[', { text: 'invalid' }], ['body .missing', { text: 'missing' }],
        ];
        const changes: LayoutChanges = { '/tools/': Object.fromEntries(reversed ? entries.reverse() : entries) };
        if (kind === 'page') applyPageLayout(f.doc, changes, '/tools/');
        else createEditorLayoutApplier(f.doc, '/tools/').apply(changes);
        assert.equal(f.node.data, '');
        assert.equal(f.values.get('color'), 'blue');
        assert.equal(f.values.get('display'), 'flex');
        assert.equal(f.node.parentNode, f.el);
      });
    }
  }
}

test('tracked common removal reveals legacy, and full removal restores source', () => {
  const f = fixture();
  const applier = createEditorLayoutApplier(f.doc, '/tools/');
  const legacy = { 'body > span:nth-of-type(1)': { text: 'legacy', hidden: true } };
  applier.apply({ '/tools/': { 'body .tool-topbar': { text: 'common', hidden: false }, ...legacy } });
  assert.equal(f.node.data, 'common');
  assert.equal(f.values.get('display'), 'flex');
  applier.apply({ '/tools/': legacy });
  assert.equal(f.node.data, 'legacy');
  assert.equal(f.values.get('display'), 'none');
  applier.apply({ '/tools/': { ...legacy, 'body .tool-topbar': { text: 'again', hidden: false } } });
  assert.equal(f.node.data, 'again');
  assert.equal(f.values.get('display'), 'flex');
  applier.apply({});
  assert.equal(f.node.data, 'original');
  assert.equal(f.values.get('display'), 'flex');
});
