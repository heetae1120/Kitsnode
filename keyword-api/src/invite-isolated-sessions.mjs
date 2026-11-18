// Browser-process building block, not a login broker or an HTTP endpoint.
// The operator must provide a trusted, user-accessible Puppeteer browser and
// arrange for each person to interact with only their own context. Login,
// account ownership, caller authorization and the UI handoff are not verified.
const LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
const MAX_LIFETIME_MS = 15 * 60 * 1000;

export async function createInviteIsolatedSessions({ browser, lifetimeMs = MAX_LIFETIME_MS } = {}) {
  if (!browser || typeof browser.createBrowserContext !== 'function' ||
      !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000 || lifetimeMs > MAX_LIFETIME_MS) {
    throw new TypeError('invalid_configuration');
  }
  const contexts = [];
  let closed = false;
  let timer;
  let closePromise;
  const close = () => {
    if (closePromise) return closePromise;
    closed = true;
    clearTimeout(timer);
    closePromise = Promise.allSettled(contexts.map(context => context.close())).then(() => undefined);
    return closePromise;
  };
  try {
    const advertiserContext = await browser.createBrowserContext();
    contexts.push(advertiserContext);
    const recipientContext = await browser.createBrowserContext();
    if (recipientContext === advertiserContext) throw Error('contexts_not_isolated');
    contexts.push(recipientContext);
    const advertiser = await advertiserContext.newPage();
    const recipient = await recipientContext.newPage();
    if (advertiser === recipient || advertiser.browserContext() !== advertiserContext || recipient.browserContext() !== recipientContext) throw Error('contexts_not_isolated');
    // Start the expiry before any navigation so a stalled site cannot retain a
    // context indefinitely. The caller must close immediately on cancellation.
    timer = setTimeout(() => { void close(); }, lifetimeMs);
    timer.unref?.();
    await Promise.all([advertiser.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }), recipient.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })]);
    if (closed) throw Error('expired');
    return Object.freeze({ advertiser, recipient, close });
  } catch {
    await close();
    throw Error('session_start_failed');
  }
}
