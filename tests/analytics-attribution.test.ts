import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttribution, UNKNOWN_ATTRIBUTION } from '../src/lib/analytics-attribution';
import { createAnalyticsView } from '../src/lib/analytics';
const origin = 'https://heetae1120.github.io';
test('referrer categories exclude the URL, query, path, and spoof domains', () => {
  assert.deepEqual(classifyAttribution('', 'https://search.naver.com/search?query=private', origin), {basis:'referrer',source:'naver',medium:'organic',campaign:'none'});
  for (const referrer of ['https://naver.com.evil.test/private?phone=123', 'https://unregistered.example/person']) assert.equal(classifyAttribution('',referrer,origin).source,'other_referral');
  for (const referrer of ['', 'broken', 'javascript:alert(1)', 'https://name:password@naver.com']) assert.deepEqual(classifyAttribution('',referrer,origin),UNKNOWN_ATTRIBUTION);
});
test('explicit finite UTM source and medium override referrer; campaign values never leave parser', () => {
  assert.deepEqual(classifyAttribution('?utm_source=NAVER&utm_medium=cpc&utm_campaign=secret-name', 'https://google.com', origin),{basis:'utm',source:'naver',medium:'paid_search',campaign:'other_tagged'});
  for (const q of ['?utm_source=person@example.com&utm_medium=01012345678&utm_campaign=private','?utm_source=google&utm_source=naver&utm_medium=__proto__','?utm_source=constructor&utm_medium=toString']) {
    const a=classifyAttribution(q,'',origin); assert.equal(a.source,'other_tagged');assert.equal(a.medium,'other_tagged');
  }
  assert.deepEqual(classifyAttribution('?gclid=secret&utm_term=private&utm_content=person','',origin),UNKNOWN_ATTRIBUTION);
});
test('SPA internal navigation does not reuse original external referrer', () => {
  assert.equal(classifyAttribution('', 'https://google.com',origin,true).basis,'internal');
  assert.equal(classifyAttribution('',origin+'/Kitsnode/tools/',origin).basis,'internal');
});
test('snapshot freezes attribution for all heartbeats and preserves version 2 timing', () => {
  const a=classifyAttribution('?utm_source=naver&utm_medium=cpc','','https://test.test');
  let time=0; const v=createAnalyticsView('/tools/', '00000000-0000-4000-8000-000000000001',()=>time,true,a);
  a.source='google';time=100;const first=v.snapshot('heartbeat')!;
  assert.equal(first.version,3); assert.equal(first.attribution.source,'naver');
  time=200;assert.deepEqual(v.snapshot('pagehide')!.attribution,first.attribution);
});
