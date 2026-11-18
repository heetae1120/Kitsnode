// Read-only Puppeteer observation. A visible membership row does not prove
// account ownership or that an invitation was sent by this application.
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const accountPattern = /^[1-9][0-9]{0,15}$/;

export async function observeNaverMember({ page, accountId, recipientId, viewerId }) {
  if (!page || !accountPattern.test(accountId || '') || !idPattern.test(recipientId || '') || !idPattern.test(viewerId || '')) return { status: 'unverified' };
  try {
    // Puppeteer page.evaluate runs a read-only DOM snapshot inside the current
    // document. Check URL inside the snapshot as well to avoid navigation races.
    const observation = await page.evaluate(({ accountId, recipientId, viewerId }) => {
      const url = new URL(location.href);
      if (url.origin !== 'https://ads.naver.com' || url.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || url.search || url.hash) return false;
      const visible = e => e.getClientRects().length > 0;
      const links = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === viewerId && e.href === 'https://ads.naver.com/settings/profile-info');
      const tabs = [...document.querySelectorAll('[role="tab"]')].filter(e => visible(e) && /^권한 받은 회원(?:\s|$)/.test(e.textContent.trim()) && e.getAttribute('aria-selected') === 'true');
      if (links.length !== 1 || tabs.length !== 1) return false;
      const rows = [...document.querySelectorAll('tr')].filter(visible).map(row => [...row.querySelectorAll(':scope > td')].map(cell => cell.innerText.trim()));
      const matches = rows.filter(cells => cells.length === 5 && (cells[0] === recipientId || cells[0] === `본인 ${recipientId}`));
      return matches.length === 1 && /^운영 관리(?:\s+권한 레벨 수정)?$/.test(matches[0][1]) && matches[0][3] === '정상';
    }, { accountId, recipientId, viewerId });
    return observation === true ? { status: 'active_member_observed', accountId, recipientId, role: 'OPERATIONS_MANAGER' } : { status: 'unverified' };
  } catch {
    return { status: 'unverified' };
  }
}
