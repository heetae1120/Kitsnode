import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW_PROTOCOL, isPreviewMessage, previewOrigins, previewUrl, validPreviewSnapshot, startFrontendPreview, validPreviewStage, detectPreviewStage } from '../src/lib/layout-preview';
const session = 'a'.repeat(32);
const changes = { '/tools/': { 'body > main > h1': { text: '합성 초안' } } };
test('preview URL preserves frontend base path but carries no draft or unrelated query', () => {
  const url = previewUrl('https://example.test/Kitsnode/?secret=discard#discard', '/tools/', session);
  assert.equal(url.pathname, '/Kitsnode/tools/');
  assert.deepEqual([...url.searchParams.keys()], ['kits_preview', 'kits_preview_session']);
  assert.equal(url.hash, '');
  assert.throws(() => previewUrl('javascript:alert(1)', '/tools/', session));
  assert.throws(() => previewUrl('https://user:password@example.test', '/tools/', session));
  assert.throws(() => previewUrl('https://example.test', '/admin/', session));
  assert.throws(() => previewUrl('https://example.test', '/tools/', 'guess'));
});
test('origin allowlist is exact, never a wildcard, and only explicit loopback HTTP', () => {
  const origins = previewOrigins('*,http://localhost:3000,https://admin.test,https://admin.test/path,http://unsafe.test');
  assert.ok(origins.includes('http://localhost:3000'));
  assert.ok(origins.includes('https://admin.test'));
  assert.equal(origins.length, 3);
});
test('snapshot accepts only one allowed page and bounded known patches', () => {
  assert.equal(validPreviewSnapshot('/tools/', changes), true);
  assert.equal(validPreviewSnapshot('/tools/', { ...changes, '/tools/seo/': {} }), false);
  assert.equal(validPreviewSnapshot('/tools/private/', { '/tools/private/': {} }), false);
  assert.equal(validPreviewSnapshot('/tools/', { '/tools/': { 'body h1': { text: 'a'.repeat(4001) } } }), false);
  assert.equal(validPreviewSnapshot('/tools/', { '/tools/': { 'body h1': { html: '<script />' } } }), false);
  assert.equal(isPreviewMessage({ protocol: PREVIEW_PROTOCOL, session, type: 'ready' }, session, 'ready'), true);
  assert.equal(isPreviewMessage({ protocol: PREVIEW_PROTOCOL, session: 'wrong', type: 'ready' }, session, 'ready'), false);
});
test('handshake rejects wrong origin/source/session; sends only clicked-page snapshot and cleans up', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let listener: ((event: MessageEvent) => void) | undefined;
  let target = '';
  const posts: { data: Record<string, unknown>; origin: string }[] = [];
  const statuses: string[] = [];
  const popup = { closed: false, close() { this.closed = true; }, postMessage(data: Record<string, unknown>, origin: string) { posts.push({ data, origin }); } };
  const timers = new Map<number, () => void>(); let next = 0;
  const fakeWindow = {
    open(url: string) { target = url; return popup; },
    addEventListener(_type: string, callback: typeof listener) { listener = callback; },
    removeEventListener() { listener = undefined; },
    setTimeout(fn: () => void) { timers.set(++next, fn); return next; },
    clearTimeout(id: number) { timers.delete(id); },
    setInterval(fn: () => void) { timers.set(++next, fn); return next; },
    clearInterval(id: number) { timers.delete(id); },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  try {
    const control = startFrontendPreview({ page: '/tools/', stage: '3', changes: { ...changes, '/tools/seo/': { 'body h1': { text: 'private other page' } } }, frontendUrl: 'http://localhost:3100', onStatus: status => statuses.push(status) });
    const nonce = new URL(target).searchParams.get('kits_preview_session');
    const data = { protocol: PREVIEW_PROTOCOL, session: nonce, type: 'ready' };
    const emit = (origin: string, source: unknown, message: unknown = data) => listener?.({ origin, source, data: message } as MessageEvent);
    emit('https://evil.test', popup); emit('http://localhost:3100', {}); emit('http://localhost:3100', popup, { ...data, session: 'wrong' });
    assert.equal(posts.length, 0);
    emit('http://localhost:3100', popup);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].origin, 'http://localhost:3100');
    assert.deepEqual(posts[0].data.changes, changes);
    assert.equal(posts[0].data.stage, '3');
    assert.equal(new URL(target).searchParams.has('stage'), false);
    emit('http://localhost:3100', popup);
    assert.equal(posts.length, 1);
    emit('http://localhost:3100', popup, { ...data, type: 'applied' });
    assert.deepEqual(statuses, ['connecting', 'ready']);
    control.close();
    assert.equal(listener, undefined); assert.equal(timers.size, 0); assert.equal(popup.closed, true);
    popup.closed = false;
    const timeoutControl = startFrontendPreview({ page: '/tools/', changes, frontendUrl: 'http://localhost:3100', onStatus: status => statuses.push(status) });
    const staleListener = listener as ((event: MessageEvent) => void) | undefined;
    const timeout = [...timers.values()][0];
    timeout();
    assert.equal(statuses.at(-1), 'timeout');
    assert.equal(listener, undefined); assert.equal(timers.size, 0);
    const count = posts.length;
    staleListener?.({ origin: 'http://localhost:3100', source: popup, data } as unknown as MessageEvent);
    assert.equal(posts.length, count);
    timeoutControl.close(); assert.equal(popup.closed, true);
    fakeWindow.open = () => null as unknown as typeof popup;
    startFrontendPreview({ page: '/tools/', changes, frontendUrl: 'http://localhost:3100', onStatus: status => statuses.push(status) });
    assert.equal(statuses.at(-1), 'blocked'); assert.equal(timers.size, 0);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('stage is page-scoped, nonpersonal, and detected from the actual nested DOM marker', () => {
  assert.equal(validPreviewStage('/tools/', '4'), true);
  assert.equal(validPreviewStage('/tools/', 'survey-7'), false);
  assert.equal(validPreviewStage('/tools/survey/', 'survey-7'), true);
  assert.equal(validPreviewStage('/tools/survey/', 'survey-8'), false);
  assert.equal(validPreviewStage('/tools/about/', 'report'), false);
  assert.equal(validPreviewStage('/tools/', { phone: 'private' }), false);
  assert.equal(validPreviewStage('/tools/', undefined), true);
  const fakeDoc = { querySelectorAll: () => ['intake', 'intake-contact'].map(value => ({ getAttribute: () => value })) } as unknown as Document;
  assert.equal(detectPreviewStage(fakeDoc, '/tools/start/'), 'intake-contact');
  assert.equal(detectPreviewStage(fakeDoc, '/tools/survey/'), undefined);
});
