import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorLayoutApplier } from '../src/lib/editor-layout-applier';
import { isUniqueLayoutSelector, orderedLayoutEntries } from '../src/lib/layout-edits';
import { selectorFor } from '../src/components/live-editor-bridge';

const legacy = 'body > div:nth-of-type(1) > span:nth-of-type(1)';
const branch = (stage: string) => `body:has(.business-intake[data-preview-stage="${stage}"]) > div:nth-of-type(1) > span:nth-of-type(1)`;

test('the same visitor element path is scoped to its current real market branch', () => {
  let stage = 'market-direct';
  const body = { tagName: 'BODY', children: [] as unknown[] };
  const marker = { getAttribute: () => stage };
  const doc = { body, querySelector: () => null };
  const wrapper = { tagName: 'DIV', children: [] as unknown[], parentElement: body };
  const target = { tagName: 'SPAN', parentElement: wrapper, ownerDocument: doc, getAttribute: () => null, closest: (query: string) => query.startsWith('.business-intake') ? marker : null };
  body.children.push(wrapper); wrapper.children.push(target);
  assert.equal(selectorFor(target as unknown as Element, '/tools/market/', 'page'), branch('market-direct'));
  stage = 'market-profit';
  assert.equal(selectorFor(target as unknown as Element, '/tools/market/', 'page'), branch('market-profit'));
  stage = 'untrusted';
  assert.equal(selectorFor(target as unknown as Element, '/tools/market/', 'page'), '');
});

test('market branch overrides legacy regardless of insertion order, but common remains last', () => {
  const a = branch('market-direct');
  for (const entries of [[a, legacy, 'body .tool-topbar'], ['body .tool-topbar', legacy, a]]) {
    assert.deepEqual(orderedLayoutEntries(Object.fromEntries(entries.map(x => [x, {}]))).map(([key]) => key), [legacy, a, 'body .tool-topbar']);
  }
  assert.equal(isUniqueLayoutSelector('/tools/market/', a), true);
  assert.equal(isUniqueLayoutSelector('/tools/', a), false);
});

test('market transitions restore the legacy target, avoid other branches, and reject ambiguous targets', () => {
  let current = 'market-direct', duplicates = false;
  const values = new Map<string, string>();
  const style = { getPropertyValue: (key: string) => values.get(key) || '', getPropertyPriority: () => '', setProperty: (key: string, value: string) => values.set(key, value), removeProperty: (key: string) => values.delete(key) };
  const node = { nodeType: 3, data: 'original', parentNode: null as unknown };
  const el = { namespaceURI: 'http://www.w3.org/1999/xhtml', tagName: 'SPAN', childNodes: [node], style } as unknown as HTMLElement;
  node.parentNode = el;
  const doc = { querySelector: (selector: string) => selector === legacy ? el : null, querySelectorAll: (selector: string) => selector === branch(current) ? (duplicates ? [el, el] : [el]) : [] } as unknown as Document;
  const applier = createEditorLayoutApplier(doc, '/tools/market/');
  const patches = { '/tools/market/': { [branch('market-profit')]: { text: 'profit' }, [branch('market-direct')]: { text: 'direct' }, [legacy]: { text: 'legacy' } } };
  applier.apply(patches); assert.equal(node.data, 'direct');
  current = 'market-profit'; applier.apply(patches); assert.equal(node.data, 'profit');
  current = 'market-start'; applier.apply(patches); assert.equal(node.data, 'legacy');
  current = 'market-direct'; duplicates = true; applier.apply(patches); assert.equal(node.data, 'legacy');
  applier.dispose(); assert.equal(node.data, 'original');
});
