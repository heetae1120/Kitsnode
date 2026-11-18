// Read-only observations. Naver's visible rows do not expose an invitation ID
// or prove that this application caused an invitation. These observations must
// not be used as a verified evidence provider for invite-local-workflow.
import { observeNaverMember } from './naver-invite-observer.mjs';
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const account = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);

export async function observePendingInvitation({advertiserPage, recipientPage, accountId, viewerId, recipientId} = {}) {
  if (!advertiserPage || !recipientPage || advertiserPage === recipientPage || !account(accountId) || !id(viewerId) || !id(recipientId)) return {status:'unverified'};
  try {
    const sender = await advertiserPage.evaluate(({accountId,viewerId,recipientId}) => {
      const u = new URL(location.href);
      if (u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/inviting` || u.search || u.hash) return false;
      const visible = e => e.getClientRects().length > 0;
      const links = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === viewerId && e.href === 'https://ads.naver.com/settings/profile-info');
      const tabs = [...document.querySelectorAll('[role=tab]')].filter(e => visible(e) && /^초대 중인 회원(?:\s|$)/.test(e.textContent.trim()) && e.getAttribute('aria-selected') === 'true');
      const rows = [...document.querySelectorAll('tr')].filter(visible).map(r => [...r.querySelectorAll(':scope > td')].map(c => c.innerText.trim()));
      const matches = rows.filter(c => c.length === 4 && c[0] === recipientId);
      return links.length === 1 && tabs.length === 1 && matches.length === 1 && /^운영 관리(?:\s+권한 레벨 수정)?$/.test(matches[0][1]);
    }, {accountId,viewerId,recipientId});
    if (sender !== true) return {status:'unverified'};
    const receiver = await recipientPage.evaluate(({accountId,recipientId}) => {
      const u = new URL(location.href);
      if (u.origin !== 'https://ads.naver.com' || u.pathname !== '/settings/ad-account/invited' || u.search || u.hash) return false;
      const visible = e => e.getClientRects().length > 0;
      const links = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === recipientId && e.href === 'https://ads.naver.com/settings/profile-info');
      const tabs = [...document.querySelectorAll('[role=tab]')].filter(e => visible(e) && /^초대 받은 광고 계정(?:\s|$)/.test(e.textContent.trim()) && e.getAttribute('aria-selected') === 'true');
      const rows = [...document.querySelectorAll('tr')].filter(visible).filter(r => {
        const cells = [...r.querySelectorAll(':scope > td')].map(c => c.innerText.replace(/\s+/g,' ').trim());
        return cells.length === 4 && new RegExp(`^\\(\\s*${accountId}\\s*\\)(?:\\s|$)`).test(cells[0]);
      });
      return links.length === 1 && tabs.length === 1 && rows.length === 1 && rows[0].querySelectorAll(':scope > td')[1].innerText.trim() === '운영 관리';
    }, {accountId,recipientId});
    if (receiver !== true) return {status:'unverified'};
    // Two consistent views are an observation only. In particular, the row
    // might belong to a prior invitation, and pages can change between reads.
    return {status:'pending_observed_unattributed', accountId, recipientId, role:'OPERATIONS_MANAGER'};
  } catch { return {status:'unverified'}; }
}

export async function observeAcceptedMembership({advertiserPage, accountId, viewerId, recipientId} = {}) {
  const result = await observeNaverMember({page:advertiserPage,accountId,viewerId,recipientId});
  return result.status === 'active_member_observed'
    ? {status:'active_member_observed_unattributed', accountId, recipientId, role:'OPERATIONS_MANAGER'}
    : {status:'unverified'};
}
