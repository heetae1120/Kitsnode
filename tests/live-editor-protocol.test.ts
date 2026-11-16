import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAuthoritativeSnapshot } from '../src/lib/live-inline-text-editor';

test('authoritative undo cancels unfinished input without committing over the saved draft', () => {
  let draft = 'saved'; let commits = 0; const calls: string[] = [];
  const session = { element: {} as HTMLElement, finish(cancel?: boolean) { calls.push(`finish:${cancel}`); if (!cancel) { draft = 'unfinished input'; commits++; } } };
  applyAuthoritativeSnapshot(session, () => { calls.push('apply'); draft = 'previous saved draft'; });
  assert.deepEqual(calls, ['finish:true', 'apply']);
  assert.equal(commits, 0);
  assert.equal(draft, 'previous saved draft');
});
import { LIVE_EDITOR_PROTOCOL, resolveSingleLiveEditorElement, trustedLiveEditorMessage } from '../src/lib/live-editor-protocol';
import { validPreviewSnapshot, validPreviewStage } from '../src/lib/layout-preview';
import { isDraftPreviewMode } from '../src/lib/draft-preview-stage';
import { analyticsAllowed } from '../src/lib/analytics';
import { consultationEndpoint } from '../src/lib/consultation-api';

test('live editor requires exact parent window, origin, 128-bit session and protocol', () => {
  const parent = {}, self = {}, session = 'a'.repeat(32), origins = ['https://editor.example.test'];
  const event = { origin: origins[0], source: parent, data: { protocol: LIVE_EDITOR_PROTOCOL, session, type: 'init' } };
  assert.equal(trustedLiveEditorMessage(event as never, parent, self, session, origins), true);
  assert.equal(trustedLiveEditorMessage({ ...event, origin: 'https://evil.example.test' } as never, parent, self, session, origins), false);
  assert.equal(trustedLiveEditorMessage({ ...event, source: {} } as never, parent, self, session, origins), false);
  assert.equal(trustedLiveEditorMessage({ ...event, data: { ...event.data, session: 'b'.repeat(32) } } as never, parent, self, session, origins), false);
  assert.equal(trustedLiveEditorMessage({ ...event, data: { ...event.data, protocol: 'other' } } as never, parent, self, session, origins), false);
  assert.equal(trustedLiveEditorMessage(event as never, parent, parent, session, origins), false);
  assert.equal(trustedLiveEditorMessage(event as never, parent, self, 'guess', origins), false);
});

test('selection fails closed for invalid, missing and duplicate DOM targets', () => {
  const element = {} as HTMLElement;
  const doc = (count: number) => ({ querySelectorAll: () => Array(count).fill(element) }) as unknown as Pick<Document, 'querySelectorAll'>;
  assert.equal(resolveSingleLiveEditorElement(doc(1), 'body > main'), element);
  assert.equal(resolveSingleLiveEditorElement(doc(0), 'body > main'), null);
  assert.equal(resolveSingleLiveEditorElement(doc(2), 'body > main'), null);
  assert.equal(resolveSingleLiveEditorElement(doc(1), 'main'), null);
  assert.equal(resolveSingleLiveEditorElement({ querySelectorAll: () => { throw new Error('bad selector'); } } as never, 'body > bad'), null);
});

test('live snapshots and stages stay within existing page and field contract', () => {
  assert.equal(validPreviewSnapshot('/tools/', { '/tools/': { 'body > main:nth-of-type(1)': { text: '합성' } } }), true);
  assert.equal(validPreviewSnapshot('/tools/', { '/tools/': {}, '/tools/start/': {} }), false);
  assert.equal(validPreviewSnapshot('/tools/', { '/tools/': { 'body > main:nth-of-type(1)': { html: '<script>' } } }), false);
  assert.equal(validPreviewStage('/tools/', '3-keywords'), true);
  assert.equal(validPreviewStage('/tools/', 'survey-1'), false);
});

test('live mode selects preview-safe branches before authentication, analytics or consultation', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { search: '?kits_live_editor=1&session=' + 'a'.repeat(32) } } });
    assert.equal(isDraftPreviewMode(), true);
    assert.throws(() => consultationEndpoint());
    assert.equal(analyticsAllowed({ enabled: 'true', endpoint: 'https://analytics.example.test', hostname: 'example.test', search: '?kits_live_editor=1', framed: false, hasOpener: false }), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});
