import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openLocalInviteSessions } from './invite-local-session-bridge.mjs';

let puppeteer;
try {
  const root = process.env.INVITATION_PUPPETEER_ROOT;
  puppeteer = root ? createRequire(root + '/package.json')('puppeteer-core') : await import('puppeteer-core');
} catch {}
const executablePath = process.env.INVITATION_CHROMIUM_PATH;

test('separate local browser processes isolate sessions and close', { skip: !puppeteer || !executablePath }, async () => {
  const launched = [];
  const driver = { async launch(options) {
    assert.equal(options.headless, false);
    assert.equal(options.pipe, true);
    const browser = await puppeteer.launch({ ...options, headless: true });
    launched.push(browser);
    const page = (await browser.pages())[0];
    await page.setRequestInterception(true);
    page.on('request', request => { void request.respond({ status: 200, contentType: 'text/html', body: '<html><body>isolated test</body></html>' }); });
    return browser;
  } };
  const roles = [];
  let pair;
  try {
    pair = await openLocalInviteSessions({ puppeteer: driver, executablePath, onWindowReady: async ({ role }) => { roles.push(role); } });
    assert.deepEqual(roles, ['advertiser', 'recipient']);
    await pair.advertiser.browserContext().setCookie({ name: 'test', value: 'a', url: 'https://nid.naver.com' });
    assert.equal((await pair.recipient.browserContext().cookies()).length, 0);
    await pair.recipient.browserContext().setCookie({ name: 'test', value: 'b', url: 'https://nid.naver.com' });
    assert.equal((await pair.advertiser.browserContext().cookies())[0].value, 'a');
    await pair.close();
    await pair.close();
    assert.equal(pair.advertiser.isClosed(), true);
    assert.equal(pair.recipient.isClosed(), true);
  } finally { await Promise.allSettled(launched.map(browser => browser.close())); }
});

test('launch error closes first browser and does not leak details', async () => {
  let calls = 0, closes = 0;
  const page = { goto: async () => {} };
  const driver = { async launch() { if (++calls === 2) throw Error('sensitive'); return { pages: async () => [page], close: async () => { closes++; } }; } };
  await assert.rejects(openLocalInviteSessions({ puppeteer: driver, executablePath: '/chrome' }), /^Error: session_start_failed$/);
  assert.equal(closes, 1);
});

test('invalid configuration fails before launching', async () => {
  let calls = 0;
  await assert.rejects(openLocalInviteSessions({ puppeteer: { launch: async () => { calls++; } }, executablePath: '/chrome', lifetimeMs: 0 }), TypeError);
  assert.equal(calls, 0);
});

test('an unanswered interactive prompt expires and closes its browser', async () => {
  let closes = 0;
  const page = { goto: async () => {} };
  const driver = { launch: async () => ({ pages: async () => [page], close: async () => { closes++; } }) };
  // Hold the event loop open because the bridge intentionally unreferences its timer.
  const keepAlive = setTimeout(() => {}, 2_000);
  try {
    await assert.rejects(openLocalInviteSessions({ puppeteer: driver, executablePath: '/chrome', lifetimeMs: 1_000,
      onWindowReady: () => new Promise(() => {}) }), /^Error: session_start_failed$/);
    assert.equal(closes, 1);
  } finally { clearTimeout(keepAlive); }
});

test('an expired launch returns promptly and closes a browser that arrives late', async () => {
  let finishLaunch, closes = 0;
  const driver = { launch: () => new Promise(resolve => { finishLaunch = resolve; }) };
  const keepAlive = setTimeout(() => {}, 2_000);
  try {
    await assert.rejects(openLocalInviteSessions({ puppeteer: driver, executablePath: '/chrome', lifetimeMs: 1_000 }), /^Error: session_start_failed$/);
    finishLaunch({ close: async () => { closes++; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(closes, 1);
  } finally { clearTimeout(keepAlive); }
});

test('a stalled page navigation expires and closes the started browser', async () => {
  let closes = 0;
  const driver = { launch: async () => ({ pages: async () => [{ goto: () => new Promise(() => {}) }], close: async () => { closes++; } }) };
  const keepAlive = setTimeout(() => {}, 2_000);
  try {
    await assert.rejects(openLocalInviteSessions({ puppeteer: driver, executablePath: '/chrome', lifetimeMs: 1_000 }), /^Error: session_start_failed$/);
    assert.equal(closes, 1);
  } finally { clearTimeout(keepAlive); }
});
