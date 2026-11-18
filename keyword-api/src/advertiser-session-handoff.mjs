// Candidate server-side handoff contract. This module does not create a remote
// browser or authenticate Naver; the broker must issue single-use leases only
// after a member has personally signed into its isolated browser. No cookies,
// passwords, verification codes or page content are returned to callers.
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const account = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);
const naverId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);

// A visible ID and account URL are checks of the current browser display, not
// cryptographic authentication, proof of ownership, or proof of invite rights.
export async function observeAdvertiserSession({ page, accountId, advertiserId } = {}) {
  if (!page || typeof page.evaluate !== 'function' || !account(accountId) || !naverId(advertiserId)) return false;
  try {
    return await page.evaluate(({accountId, advertiserId}) => {
      const u = new URL(location.href);
      if (u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || u.search || u.hash) return false;
      const profiles = [...document.querySelectorAll('a')].filter(e => e.getClientRects().length > 0 && e.textContent.trim() === advertiserId && e.href === 'https://ads.naver.com/settings/profile-info');
      const inviteButtons = [...document.querySelectorAll('button')].filter(e => e.getClientRects().length > 0 && !e.disabled && e.textContent.trim() === '회원 초대');
      return profiles.length === 1 && inviteButtons.length === 1;
    }, {accountId, advertiserId}) === true;
  } catch { return false; }
}

// claim() must atomically consume a one-time lease bound to the expected
// request and authenticated application session; this is not implemented here.
export function createAdvertiserSessionHandoff({ auth, requests, broker, observe = observeAdvertiserSession } = {}) {
  if (![auth?.verify, requests?.get, broker?.claim, observe].every(x => typeof x === 'function')) throw TypeError('invalid_configuration');
  return async function withSession({ token, requestId, run } = {}) {
    if (typeof token !== 'string' || !token || !uuid(requestId) || typeof run !== 'function') return {status:'blocked'};
    let lease, runStarted = false;
    try {
      const principal = await auth.verify(token);
      if (!principal || !uuid(principal.userId) || typeof principal.sessionBinding !== 'string' || !principal.sessionBinding) return {status:'blocked'};
      const req = await requests.get(requestId);
      if (!req || req.requestId !== requestId || req.userId !== principal.userId || req.status !== 'pending_review' || !Number.isSafeInteger(req.revision) || req.revision < 0 || !account(req.accountId) || !naverId(req.advertiserId)) return {status:'blocked'};
      const bound = {requestId, userId:principal.userId, sessionBinding:principal.sessionBinding, accountId:req.accountId, advertiserId:req.advertiserId, revision:req.revision};
      lease = await broker.claim(bound);
      if (!lease || !lease.page || typeof lease.close !== 'function' || lease.requestId !== requestId || lease.userId !== principal.userId || lease.sessionBinding !== principal.sessionBinding || lease.accountId !== req.accountId || lease.advertiserId !== req.advertiserId || lease.revision !== req.revision) return {status:'blocked'};
      if (await observe({page:lease.page,accountId:req.accountId,advertiserId:req.advertiserId}) !== true) return {status:'blocked'};
      const current = await auth.verify(token);
      const now = await requests.get(requestId);
      if (!current || current.userId !== principal.userId || current.sessionBinding !== principal.sessionBinding || !now || now.requestId !== requestId || now.userId !== principal.userId || now.status !== 'pending_review' || now.revision !== req.revision || now.accountId !== req.accountId || now.advertiserId !== req.advertiserId) return {status:'blocked'};
      // run is trusted server code. It must independently recheck consent and
      // reservation before any mutation; this handoff is not authorization.
      runStarted = true;
      return await run({page:lease.page,requestId,userId:principal.userId,accountId:req.accountId,advertiserId:req.advertiserId});
    } catch { return runStarted ? {status:'uncertain',retry:'disabled'} : {status:'blocked'}; }
    finally { if (typeof lease?.close === 'function') { try { await lease.close(); } catch {} } }
  };
}
