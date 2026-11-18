import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { observeNaverMember } from './naver-invite-observer.mjs';

const runtime = process.env.INVITATION_PLAYWRIGHT_ROOT;
let chromium;
try { chromium = (runtime ? createRequire(runtime + '/package.json')('playwright') : await import('playwright')).chromium; } catch {}
const executablePath = process.env.INVITATION_CHROMIUM_PATH;
const skip = !chromium || !executablePath;
const base = 'https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited';
const row = '<tr><td>recipient</td><td>운영 관리</td><td>2026.11.18.</td><td>정상</td><td>권한 해제</td></tr>';
async function withPage({ url = base, rows = row, selected = 'true', viewer = 'operator' } = {}, fn) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    // All network is intercepted and served locally; the real site is never contacted.
    await context.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<a href="https://ads.naver.com/settings/profile-info">${viewer}</a><div role="tab" aria-selected="${selected}">권한 받은 회원 1</div><table>${rows}</table>` }));
    const page = await context.newPage();
    await page.goto(url);
    await fn({ page, accountId: '123', recipientId: 'recipient', viewerId: 'operator' });
  } finally { await browser.close(); }
}
test('reads exact active operations manager using a Puppeteer-compatible page.evaluate', { skip }, async () => withPage({}, async input => {
  assert.deepEqual(await observeNaverMember(input), { status: 'active_member_observed', accountId: '123', recipientId: 'recipient', role: 'OPERATIONS_MANAGER' });
}));
test('rejects other accounts, origins, viewers and tabs', { skip }, async () => {
  for (const options of [{ url: base.replace('/123/', '/124/') }, { url: base.replace('ads.naver.com', 'ads.naver.com.evil.test') }, { viewer: 'other' }, { selected: 'false' }]) {
    await withPage(options, async input => assert.deepEqual(await observeNaverMember(input), { status: 'unverified' }));
  }
});
test('missing, duplicate, different-role and inactive rows stay unverified', { skip }, async () => {
  for (const rows of ['', row + row, row.replace('운영 관리', '조회'), row.replace('정상', '중지')]) {
    await withPage({ rows }, async input => assert.deepEqual(await observeNaverMember(input), { status: 'unverified' }));
  }
});
test('malformed identifiers do not evaluate the page', async () => {
  const page = { evaluate: () => { throw Error('must not call'); } };
  assert.deepEqual(await observeNaverMember({ page, accountId: '../123', recipientId: 'recipient', viewerId: 'operator' }), { status: 'unverified' });
});
