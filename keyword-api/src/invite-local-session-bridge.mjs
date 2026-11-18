// Local, interactive test building block. Both windows are controlled by the
// same person on the same machine. This is not a remote login service, does
// not authenticate a Kitsnode member, and does not retain cookies or passwords.
const LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
const DEFAULT_LIFETIME_MS = 15 * 60_000;

export async function openLocalInviteSessions({ puppeteer, executablePath, onWindowReady = async () => {}, lifetimeMs = DEFAULT_LIFETIME_MS } = {}) {
  if (!puppeteer || typeof puppeteer.launch !== 'function' || typeof executablePath !== 'string' || !executablePath ||
      typeof onWindowReady !== 'function' || !Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000 || lifetimeMs > DEFAULT_LIFETIME_MS) {
    throw new TypeError('invalid_configuration');
  }
  const browsers = [];
  let closed = false;
  let timer;
  let closing;
  let signalClosed;
  const closedSignal = new Promise(resolve => { signalClosed = resolve; });
  const close = () => {
    if (closing) return closing;
    closed = true;
    clearTimeout(timer);
    signalClosed();
    closing = Promise.allSettled(browsers.map(browser => browser.close())).then(() => undefined);
    return closing;
  };
  // A deadline also applies while Chrome or the login page is loading.
  timer = setTimeout(() => { void close(); }, lifetimeMs);
  timer.unref?.();
  const untilClosed = () => closedSignal.then(() => { throw Error('expired'); });
  async function launch(role) {
    const launching = Promise.resolve().then(() => puppeteer.launch({ executablePath, headless: false, pipe: true,
      args: ['--no-first-run', '--no-default-browser-check'] }));
    // A hung launch must not block expiry. If Chrome appears after expiry it
    // was not in the cleanup list, so close it as soon as it becomes available.
    void launching.then(browser => { if (closed) return browser.close(); }).catch(() => {});
    const browser = await Promise.race([launching, untilClosed()]);
    if (closed) throw Error('expired');
    browsers.push(browser);
    const pages = await Promise.race([browser.pages(), untilClosed()]);
    const page = pages[0] || await Promise.race([browser.newPage(), untilClosed()]);
    await Promise.race([page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }), untilClosed()]);
    if (closed) throw Error('expired');
    // The caller displays role-specific instructions and may wait for the
    // user; the callback is not evidence that authentication succeeded.
    await Promise.race([onWindowReady({ role, page }), untilClosed()]);
    if (closed) throw Error('expired');
    return { browser, page };
  }
  try {
    // Start sequentially so the local operator can identify each window.
    const advertiser = await launch('advertiser');
    const recipient = await launch('recipient');
    if (advertiser.browser === recipient.browser || advertiser.page === recipient.page) throw Error('not_isolated');
    return Object.freeze({ advertiser: advertiser.page, recipient: recipient.page, close });
  } catch {
    await close();
    throw Error('session_start_failed');
  }
}
