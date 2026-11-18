// Preparatory UI action only: it opens the Naver invitation dialog but never
// accepts policy, enters an ID, sends an invitation, or alters permissions.
// This is not wired to a route or an authenticated browser-session broker.
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
const account = value => typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value);

export async function prepareNaverInviteDialog({page, accountId, viewerId} = {}) {
  if (!page || typeof page.evaluate !== 'function' || !account(accountId) || !id(viewerId)) return {status:'unverified'};
  try {
    const opened = await page.evaluate(({accountId, viewerId}) => {
      const url = new URL(location.href);
      if (url.origin !== 'https://ads.naver.com' || url.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || url.search || url.hash) return false;
      const visible = e => e.getClientRects().length > 0;
      const profile = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === viewerId && e.href === 'https://ads.naver.com/settings/profile-info');
      const buttons = [...document.querySelectorAll('button')].filter(e => visible(e) && e.textContent.trim() === '회원 초대' && !e.disabled);
      if (profile.length !== 1 || buttons.length !== 1) return false;
      buttons[0].click();
      return true;
    }, {accountId, viewerId});
    if (!opened) return {status:'unverified'};
    // A user must inspect and independently accept the policy in this browser.
    // No assumption is made about the result of opening the modal.
    return {status:'dialog_open_requested', next:'user_policy_review'};
  } catch { return {status:'unverified'}; }
}
