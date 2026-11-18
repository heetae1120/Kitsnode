// Local operator-assisted preparation only. There is no account-ownership
// proof, remote browser transport, invitation send or acceptance here.
import { openLocalInviteSessions } from './invite-local-session-bridge.mjs';
import { prepareNaverInviteDialog } from './naver-invite-dialog.mjs';

const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const account = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);

export async function runLocalInvitePreparation({ puppeteer, executablePath, accountId, advertiserId, recipientId,
  onWindowReady, onPolicyReview, lifetimeMs, openSessions = openLocalInviteSessions,
  prepareDialog = prepareNaverInviteDialog } = {}) {
  if (!account(accountId) || !id(advertiserId) || !id(recipientId) || advertiserId === recipientId ||
      typeof onWindowReady !== 'function' || typeof onPolicyReview !== 'function' ||
      typeof openSessions !== 'function' || typeof prepareDialog !== 'function' ||
      (lifetimeMs !== undefined && (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1000 || lifetimeMs > 900000))) throw TypeError('invalid_configuration');
  let sessions;
  let timer;
  try {
    // The operator signs in separately and navigates each browser. No login
    // secret or browser state is collected by this coordinator.
    sessions = await openSessions({ puppeteer, executablePath, lifetimeMs, onWindowReady });
    if (!sessions?.advertiser || !sessions?.recipient || sessions.advertiser === sessions.recipient ||
        typeof sessions.close !== 'function') return { status: 'unverified' };
    const recipientConfirmed = await sessions.recipient.evaluate(recipientId => {
      const url = new URL(location.href);
      if (url.origin !== 'https://ads.naver.com' || url.pathname !== '/settings/profile-info' || url.search || url.hash) return false;
      const visible = el => el.getClientRects().length > 0;
      return [...document.querySelectorAll('a')].filter(el => visible(el) && el.textContent.trim() === recipientId &&
        el.href === 'https://ads.naver.com/settings/profile-info').length === 1;
    }, recipientId);
    if (recipientConfirmed !== true) return { status: 'unverified' };
    const result = await prepareDialog({ page: sessions.advertiser, accountId, viewerId: advertiserId });
    if (result?.status !== 'dialog_open_requested') return { status: 'unverified' };
    // Showing the dialog is not proof of acceptance or user authorization.
    await Promise.race([
      onPolicyReview({ page: sessions.advertiser, accountId, recipientId }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('expired')), lifetimeMs ?? 900000); }),
    ]);
    return { status: 'prepared_only', next: 'manual_review' };
  } catch {
    return { status: 'unverified' };
  } finally {
    clearTimeout(timer);
    if (typeof sessions?.close === 'function') await sessions.close();
  }
}
