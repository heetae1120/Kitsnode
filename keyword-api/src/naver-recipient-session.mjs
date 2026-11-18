// A read-only check of the signed-in account displayed by Naver. It does not
// prove advertiser ownership or replace authenticated application sessions.
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
export async function verifyNaverRecipientSession({page, recipientId} = {}) {
  if (!page || typeof page.evaluate !== 'function' || !id(recipientId)) return false;
  try {
    return await page.evaluate(recipientId => {
      const u = new URL(location.href);
      if (u.origin !== 'https://ads.naver.com' || u.pathname !== '/settings/profile-info' || u.search || u.hash) return false;
      const links = [...document.querySelectorAll('a')].filter(e => e.getClientRects().length > 0 &&
        e.textContent.trim() === recipientId && e.href === 'https://ads.naver.com/settings/profile-info');
      return links.length === 1;
    }, recipientId) === true;
  } catch { return false; }
}
