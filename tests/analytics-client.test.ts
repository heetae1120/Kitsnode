import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyticsAllowed, canonicalAnalyticsPage, createAnalyticsView, sendAnalyticsSnapshot, startVisitorAnalytics, type Snapshot } from '../src/lib/analytics';
const id = '00000000-0000-4000-8000-000000000001';
const allowed = { enabled: 'true', endpoint: 'https://metrics.example.test/collect', hostname: 'www.example.test', search: '', framed: false, hasOpener: false };
test('disabled by default; preview, local, privacy opt-out and unsafe endpoints excluded', () => {
  assert.equal(analyticsAllowed(allowed), true);
  for (const patch of [{ enabled: undefined }, { endpoint: '' }, { endpoint: 'http://test.test' }, { endpoint: 'https://test.test/?secret=x' }, { framed: true }, { hasOpener: true }, { dnt: '1' }, { gpc: true }, { hostname: 'localhost' }, { hostname: '127.0.0.1' }, { hostname: '[::1]' }, ...['kits_editor', 'kits_preview', 'kits_preview_session'].map(q => ({ search: `?${q}=` }))]) assert.equal(analyticsAllowed({ ...allowed, ...patch }), false);
});
test('canonical pages reject arbitrary, query, hash and partial base paths', () => {
  assert.equal(canonicalAnalyticsPage('/Kitsnode/tools/survey', '/Kitsnode'), '/tools/survey/');
  for (const path of ['/private/', '/tools/unknown', '/tools/?phone=secret', '/tools/#secret', '/KitsnodeX/tools/']) assert.equal(canonicalAnalyticsPage(path, '/Kitsnode'), null);
});
test('visible/engaged time excludes hidden, caps idle at 30 seconds, resumes bfcache', () => {
  let time = 0; const view = createAnalyticsView('/tools/', id, () => time, true);
  view.interaction(); time = 40_000; const first = view.snapshot('heartbeat')!;
  assert.equal(first.visibleMs, 40_000); assert.equal(first.engagedMs, 30_000);
  view.setVisible(false); assert.equal(view.snapshot('hidden'), null);
  time = 80_000; view.setVisible(false); assert.equal(view.snapshot('pagehide'), null);
  view.setVisible(true); time = 90_000; const resumed = view.snapshot('heartbeat')!;
  assert.equal(resumed.viewId, id); assert.equal(resumed.visibleMs, 50_000); assert.equal(resumed.engagedMs, 30_000); assert.equal(resumed.sequence, 2);
});
test('only allowlisted survey metadata, sticky verified contact completion, no per-key sends', () => {
  let time = 0; const view = createAnalyticsView('/tools/survey/', id, () => time, true);
  for (let i = 0; i < 100; i++) { time++; view.input('brandVision'); }
  view.input('customer-private-value'); view.setSurvey('phone-private-value', true);
  time = 15_000; const snapshot = view.snapshot('heartbeat')!;
  assert.equal(snapshot.sequence, 1); assert.deepEqual(snapshot.survey, { step: 'brandVision', lastField: 'brandVision', lastInputAgoMs: 14_900, completed: false, timing: null });
  view.setSurvey('contact', true); assert.equal(view.snapshot('complete')?.survey?.completed, true);
  assert.equal(JSON.stringify(snapshot).includes('private-value'), false);
  assert.deepEqual(Object.keys(snapshot), ['version', 'viewId', 'sequence', 'page', 'visibleMs', 'engagedMs', 'reason', 'survey']);
});
test('bounded monotonic clock and page reentry have independent IDs and totals', () => {
  let time = 100; const one = createAnalyticsView('/tools/', id, () => time, true);
  time = 0; assert.equal(one.snapshot('heartbeat')?.visibleMs, 0);
  time = 100_000_000; one.interaction(); assert.equal(one.snapshot('navigation')?.visibleMs, 86_400_000);
  const two = createAnalyticsView('/tools/', 'different-id', () => time, true);
  assert.equal(two.snapshot('heartbeat')?.visibleMs, 0);
});
test('every snapshot including close uses credential-free keepalive and rejects redirects', () => {
  const calls: RequestInit[] = [];
  const transport = {
    beacon: () => { throw new Error('Beacon must never be called'); },
    fetch: (async (_url: unknown, init: RequestInit) => { calls.push(init); return {} as Response; }) as typeof fetch,
  };
  for (const reason of ['heartbeat', 'hidden', 'pagehide', 'navigation', 'complete'] as const) {
    const payload = createAnalyticsView('/tools/', id, () => 0, true).snapshot(reason)!;
    sendAnalyticsSnapshot(allowed.endpoint, payload, transport);
    const call = calls.at(-1)!;
    assert.equal(call.credentials, 'omit'); assert.equal(call.keepalive, true);
    assert.equal(call.referrerPolicy, 'no-referrer'); assert.equal(call.redirect, 'error');
    assert.deepEqual(JSON.parse(call.body as string), payload);
  }
  assert.equal(calls.length, 5);
});
test('synthetic browser lifecycle throttles snapshots, cleans up, restores, and navigates', () => {
  const savedObserver = globalThis.MutationObserver;
  class Observer { observe() {} disconnect() {} }
  globalThis.MutationObserver = Observer as unknown as typeof MutationObserver;
  try {
    let time = 0, tick: (() => void) | undefined, clearCount = 0;
    const sent: Snapshot[] = [];
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => null });
    const win = Object.assign(new EventTarget(), { crypto: { randomUUID: () => id }, performance: { now: () => time }, navigator: { sendBeacon: () => { throw new Error('Beacon must never be called'); } }, fetch: async (_url: string, init: RequestInit) => { assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.referrerPolicy, 'no-referrer'); sent.push(JSON.parse(init.body as string)); }, setInterval: (fn: () => void, delay: number) => { assert.equal(delay, 15_000); tick = fn; return 1; }, clearInterval: () => { clearCount++; } });
    const stop = startVisitorAnalytics('/tools/', allowed.endpoint, win as unknown as Window, doc as unknown as Document);
    for (let i = 0; i < 100; i++) doc.dispatchEvent(new Event('keydown'));
    assert.equal(sent.length, 0); time = 15_000; tick!(); assert.equal(sent.length, 1);
    time = 16_000; doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('pagehide'));
    assert.equal(sent.length, 2); time = 30_000; tick!(); assert.equal(sent.length, 2);
    doc.visibilityState = 'visible'; win.dispatchEvent(new Event('pageshow')); time = 35_000; tick!(); assert.equal(sent[2].visibleMs, 21_000);
    time = 36_000; stop(true); stop(true); assert.equal(sent[3].reason, 'navigation'); assert.equal(clearCount, 1);
    time = 40_000; tick!(); win.dispatchEvent(new Event('pagehide')); assert.equal(sent.length, 4);
  } finally { globalThis.MutationObserver = savedObserver; }
});
test('completion marker is exclusively rendered after verified successful consultation', () => {
  const source = readFileSync(new URL('../src/components/store-survey.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('if (!response.ok)') < source.indexOf('setSavedId(data.id)'));
  assert.ok(source.indexOf('if (typeof data.id !== "string")') < source.indexOf('setSavedId(data.id)'));
  assert.equal(source.match(/data-analytics-completed="true"/g)?.length, 1);
  assert.match(source, /if \(savedId\)[\s\S]*data-analytics-completed="true"/);
  const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /referrer: "no-referrer"/);
});
test('survey runtime reads only marker attributes and sends completion once after confirmed card', () => {
  const previousObserver = globalThis.MutationObserver, previousElement = globalThis.Element;
  let changed = () => {};
  class Marker extends EventTarget {
    attrs: Record<string, string> = {};
    parentElement = {};
    getAttribute(key: string) { return this.attrs[key] ?? null; }
    contains(target: unknown) { return target === field; }
    get value(): never { throw new Error('Must never read typed content'); }
    get textContent(): never { throw new Error('Must never read content'); }
  }
  class Observer { constructor(callback: () => void) { changed = callback; } observe() {} disconnect() {} }
  globalThis.Element = Marker as unknown as typeof Element;
  globalThis.MutationObserver = Observer as unknown as typeof MutationObserver;
  const card = new Marker(), field = new Marker();
  try {
    card.attrs['data-analytics-step'] = 'brandVision'; field.attrs['data-analytics-field'] = 'brandVision';
    let time = 0, tick = () => {};
    const sent: Snapshot[] = [];
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', querySelector: () => card });
    const win = Object.assign(new EventTarget(), { crypto: { randomUUID: () => id }, performance: { now: () => time }, navigator: { sendBeacon: () => { throw new Error('Beacon must never be called'); } }, fetch: async (_url: string, init: RequestInit) => { assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); assert.equal(init.referrerPolicy, 'no-referrer'); sent.push(JSON.parse(init.body as string)); }, setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: () => {} });
    const stop = startVisitorAnalytics('/tools/survey/', allowed.endpoint, win as unknown as Window, doc as unknown as Document);
    for (let i = 0; i < 50; i++) { time++; const event = new Event('input'); Object.defineProperty(event, 'target', { value: field }); doc.dispatchEvent(event); }
    assert.equal(sent.length, 0); time = 15_000; tick(); assert.equal(sent[0].survey?.lastField, 'brandVision');
    card.attrs['data-analytics-step'] = 'contact'; changed(); assert.equal(sent.length, 1);
    card.attrs['data-analytics-completed'] = 'true'; changed(); changed(); assert.equal(sent.length, 2); assert.equal(sent[1].reason, 'complete'); assert.equal(sent[1].survey?.completed, true);
    stop();
  } finally { globalThis.Element = previousElement; globalThis.MutationObserver = previousObserver; }
});

test('survey timing excludes pre-card time and freezes at confirmed completion, not contact arrival', () => {
  let time = 0; const view = createAnalyticsView('/tools/survey/', id, () => time, true);
  time = 10_000; assert.equal(view.snapshot('heartbeat')?.survey?.timing, null);
  view.setSurvey('brandVision', false); view.interaction();
  time = 30_000; view.setSurvey('contact', false);
  assert.deepEqual(view.snapshot('heartbeat')?.survey?.timing, {elapsedMs:20_000,visibleMs:20_000,engagedMs:20_000});
  // Failed submit or retry never sets a completed marker.
  time = 45_000; view.setSurvey('contact', false); view.setSurvey('contact', true);
  const completion = view.snapshot('complete')!;
  assert.deepEqual(completion.survey?.timing, {elapsedMs:35_000,visibleMs:35_000,engagedMs:30_000});
  time = 145_000; view.setSurvey('brandVision', false);
  const later = view.snapshot('heartbeat')!;
  assert.equal(later.visibleMs, 145_000); assert.deepEqual(later.survey?.timing, completion.survey?.timing);
  assert.equal(later.survey?.step, 'contact'); assert.equal(later.survey?.completed, true);
});
test('survey elapsed includes hidden interruption but visible and activity do not; bfcache resumes', () => {
  let time = 0; const view = createAnalyticsView('/tools/survey/', id, () => time, true);
  view.setSurvey('brandVision', false); view.interaction(); time = 20_000; view.setVisible(false);
  time = 80_000; view.setVisible(true); time = 90_000; view.setSurvey('contact', true);
  assert.deepEqual(view.snapshot('complete')?.survey?.timing, {elapsedMs:90_000,visibleMs:30_000,engagedMs:20_000});
});
test('hidden initial card waits for visibility; restored completed card stays unknown, actual zero remains zero', () => {
  let time = 0; const hidden = createAnalyticsView('/tools/survey/', id, () => time, false);
  hidden.setSurvey('brandVision', false); time = 60_000;
  assert.equal(hidden.snapshot('heartbeat')?.survey?.timing, null);
  hidden.setVisible(true); hidden.setSurvey('brandVision', false); hidden.setSurvey('contact', true);
  assert.deepEqual(hidden.snapshot('complete')?.survey?.timing, {elapsedMs:0,visibleMs:0,engagedMs:0});
  const restored = createAnalyticsView('/tools/survey/', id, () => time, true);
  restored.setSurvey('contact', true); time += 1000;
  assert.equal(restored.snapshot('heartbeat')?.survey?.timing, null);
});
test('survey timings remain monotonic, bounded, and independent on page reentry', () => {
  let time = 100; const view = createAnalyticsView('/tools/survey/', id, () => time, true);
  view.setSurvey('brandVision', false); time = 0;
  assert.deepEqual(view.snapshot('heartbeat')?.survey?.timing,{elapsedMs:0,visibleMs:0,engagedMs:0});
  time = 100_000_000; view.setSurvey('contact', true);
  assert.deepEqual(view.snapshot('complete')?.survey?.timing,{elapsedMs:86_400_000,visibleMs:86_400_000,engagedMs:0});
  const next = createAnalyticsView('/tools/survey/', 'new-view', () => time, true);
  next.setSurvey('brandVision', false);
  assert.deepEqual(next.snapshot('heartbeat')?.survey?.timing,{elapsedMs:0,visibleMs:0,engagedMs:0});
});
test('lost completion request keeps frozen duration in later heartbeat without infinite retry', async () => {
  let time = 0; const view = createAnalyticsView('/tools/survey/', id, () => time, true);
  view.setSurvey('brandVision', false); time = 10_000; view.setSurvey('contact', true);
  const sent: Snapshot[] = [];
  const transport = {fetch: (async (_url: unknown, init: RequestInit) => {sent.push(JSON.parse(init.body as string)); if(sent.length===1)throw new Error('synthetic offline'); return {} as Response;}) as typeof fetch};
  sendAnalyticsSnapshot(allowed.endpoint,view.snapshot('complete')!,transport);
  await Promise.resolve(); time=50_000;
  sendAnalyticsSnapshot(allowed.endpoint,view.snapshot('heartbeat')!,transport);
  assert.equal(sent.length,2); assert.equal(sent[1].survey?.completed,true);
  assert.deepEqual(sent[1].survey?.timing,sent[0].survey?.timing);
});


test('late-mounted survey card is observed immediately and completion never waits for heartbeat', () => {
  const oldObserver=globalThis.MutationObserver; let changed=()=>{};const root={};let observed:unknown;
  class Observer { constructor(fn:()=>void){changed=fn;} observe(node:unknown){observed=node;} disconnect(){} }
  globalThis.MutationObserver=Observer as unknown as typeof MutationObserver;
  try {
    let time=0, card:null|{getAttribute:(key:string)=>string|null}=null, done=false, tick=()=>{};
    const sent:Snapshot[]=[];
    const doc=Object.assign(new EventTarget(),{body:root,visibilityState:'visible',querySelector:()=>card});
    const win=Object.assign(new EventTarget(),{crypto:{randomUUID:()=>id},performance:{now:()=>time},fetch:async(_url:string,init:RequestInit)=>{sent.push(JSON.parse(init.body as string));},setInterval:(fn:()=>void)=>{tick=fn;return 1;},clearInterval:()=>{}});
    const stop=startVisitorAnalytics('/tools/survey/',allowed.endpoint,win as unknown as Window,doc as unknown as Document);
    assert.equal(observed,root);
    time=5_000;card={getAttribute:key=>key==='data-analytics-step'?(done?'contact':'brandVision'):key==='data-analytics-completed'?String(done):null};changed();
    time=9_000;done=true;changed();
    assert.equal(sent.length,1);assert.equal(sent[0].reason,'complete');
    assert.deepEqual(sent[0].survey?.timing,{elapsedMs:4000,visibleMs:4000,engagedMs:0});
    time=30_000;tick();assert.deepEqual(sent[1].survey?.timing,sent[0].survey?.timing);stop();
  }finally{globalThis.MutationObserver=oldObserver;}
});
