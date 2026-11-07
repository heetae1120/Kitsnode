import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Execute the actual mount-effect body with fail-fast network/timer setup doubles.
// This avoids adding a DOM dependency or issuing any live API request.
const source = readFileSync(new URL('../src/components/automatic-keyword-discovery.tsx', import.meta.url), 'utf8');
const body = source.match(/useEffect\(\(\)=>\{([\s\S]*?)\n \},\[productName,retry\]\);/)?.[1];
assert.ok(body, 'automatic discovery mount effect must be found');
const run = new Function('isDraftPreviewMode', 'setBusy', 'setError', 'AbortController', body);
test('actual draft preview report skips keyword lookup before controller, timer, or fetch', () => {
  const busy: boolean[] = [], errors: string[] = [];
  class ForbiddenNetworkSetup { constructor() { throw new Error('Network setup must not run'); } }
  run(() => true, (value: boolean) => busy.push(value), (value: string) => errors.push(value), ForbiddenNetworkSetup);
  assert.deepEqual(busy, [false]);
  assert.deepEqual(errors, ['편집 미리보기에서는 실제 키워드를 조회하지 않습니다.']);
});
test('ordinary visitor retains existing keyword lookup path', () => {
  class VisitorNetworkSetup { constructor() { throw new Error('Visitor lookup reached'); } }
  assert.throws(() => run(() => false, () => {}, () => {}, VisitorNetworkSetup), /Visitor lookup reached/);
});
