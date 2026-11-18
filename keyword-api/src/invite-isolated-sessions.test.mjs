import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createInviteIsolatedSessions } from './invite-isolated-sessions.mjs';

let puppeteer;
try {
  const root = process.env.INVITATION_PUPPETEER_ROOT;
  puppeteer = root ? createRequire(root + '/package.json')('puppeteer-core') : await import('puppeteer-core');
} catch {}
const executablePath = process.env.INVITATION_CHROMIUM_PATH;

test('two real Puppeteer contexts isolate cookies and are destroyed on close', { skip: !puppeteer || !executablePath }, async () => {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const wrapped = {
    async createBrowserContext() {
      const context = await browser.createBrowserContext();
      const original = context.newPage.bind(context);
      context.newPage = async () => {
        const page = await original();
        await page.setRequestInterception(true);
        page.on('request', request => { void request.respond({ status: 200, contentType: 'text/html', body: '<html><body>local fixture</body></html>' }); });
        return page;
      };
      return context;
    },
  };
  try {
    const pair = await createInviteIsolatedSessions({ browser: wrapped });
    const a = pair.advertiser.browserContext();
    const b = pair.recipient.browserContext();
    assert.notEqual(a, b);
    await a.setCookie({ name: 'fixture', value: 'advertiser', url: 'https://nid.naver.com' });
    await b.setCookie({ name: 'fixture', value: 'recipient', url: 'https://nid.naver.com' });
    assert.equal((await a.cookies())[0].value, 'advertiser');
    assert.equal((await b.cookies())[0].value, 'recipient');
    await pair.close();
    await pair.close();
    assert.equal(pair.advertiser.isClosed(), true);
    assert.equal(pair.recipient.isClosed(), true);
  } finally { await browser.close(); }
});

test('failed setup closes already-created contexts without leaking details', async () => {
  let closed = 0;
  const context = { newPage: async () => { throw Error('secret'); }, close: async () => { closed++; } };
  const browser = { createBrowserContext: async () => context };
  await assert.rejects(createInviteIsolatedSessions({ browser }), /^Error: session_start_failed$/);
  assert.equal(closed, 1);
});

test('invalid lifetime is refused before creating a context', async () => {
  let calls = 0;
  const browser = { createBrowserContext: async () => { calls++; } };
  await assert.rejects(createInviteIsolatedSessions({ browser, lifetimeMs: 900001 }), TypeError);
  assert.equal(calls, 0);
});
