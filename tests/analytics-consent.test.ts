import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANALYTICS_CONSENT_KEY, readAnalyticsConsent, writeAnalyticsConsent } from '../src/lib/analytics-consent';

test('consent fails closed unless an explicit saved choice is valid', () => {
  for (const value of [null, '', 'true', 'yes', '{"allow":true}', 'unknown']) {
    assert.equal(readAnalyticsConsent({getItem: () => value, setItem() {}}), 'unset');
  }
  assert.equal(readAnalyticsConsent(null), 'unset');
  assert.equal(readAnalyticsConsent({getItem() {throw new Error('blocked');}, setItem() {}}), 'unset');
  for (const value of ['allow', 'deny'] as const) assert.equal(readAnalyticsConsent({getItem: () => value, setItem() {}}), value);
});

test('persist only the selected permission, never a visitor identifier or event', () => {
  const writes: string[][] = [];
  const storage = {getItem: () => null, setItem: (key: string, value: string) => {writes.push([key, value]);}};
  assert.equal(writeAnalyticsConsent(storage, 'allow'), true);
  assert.equal(writeAnalyticsConsent(storage, 'deny'), true);
  assert.deepEqual(writes, [[ANALYTICS_CONSENT_KEY, 'allow'], [ANALYTICS_CONSENT_KEY, 'deny']]);
  assert.equal(writeAnalyticsConsent(null, 'allow'), false);
  assert.equal(writeAnalyticsConsent({getItem: () => null, setItem() {throw new Error('quota');}}, 'deny'), false);
});

test('failed withdrawal persistence clears a stale opt-in when removal is available', () => {
  let value: string | null = 'allow';
  const store = {getItem: () => value, setItem() {throw new Error('quota');}, removeItem(key: string) {assert.equal(key, ANALYTICS_CONSENT_KEY); value = null;}};
  assert.equal(writeAnalyticsConsent(store, 'deny'), false);
  assert.equal(readAnalyticsConsent(store), 'unset');
});

test('runtime starts only after consent and withdrawal stops before persisting', () => {
  const component = readFileSync('src/components/visitor-analytics.tsx', 'utf8');
  assert.match(component, /if \(consent !== 'allow' \|\| !page \|\| !allowed\(\)\) return/);
  assert.match(component, /consentRef.current === 'allow' && eligible\(\)/);
  const choose = component.slice(component.indexOf('const choose'));
  assert.ok(choose.indexOf("if (value === 'deny')") < choose.indexOf('writeAnalyticsConsent'));
  assert.match(component, /window.addEventListener\('storage', changed\)/);
  assert.match(component, /if \(!available\) return null/);
});

test('expanded collection requires fresh opt-in but honors prior refusal', () => {
  const storage = (old: string) => ({getItem:(key:string)=>key==='kitsnode-analytics-consent-v1'?old:null,setItem(){}});
  assert.equal(readAnalyticsConsent(storage('allow')), 'unset');
  assert.equal(readAnalyticsConsent(storage('deny')), 'deny');
});
