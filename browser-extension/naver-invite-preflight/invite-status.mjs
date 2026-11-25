// Read-only observation, not proof that the current run caused an invitation.
// Runs in the selected Naver advertiser tab; never navigates or clicks.
export function observeInviteStatus({accountId,viewerId}={}) {
 try {
  if(!/^[1-9][0-9]{0,15}$/.test(accountId||'')||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId||'')||viewerId==='kitsnode')return 'unverified';
  const u=new URL(location.href),base=`/manage/ad-accounts/${accountId}/settings/authorities/members/`;
  if(u.origin!=='https://ads.naver.com'||u.search||u.hash||![`${base}invited`,`${base}inviting`].includes(u.pathname))return 'unverified';
  const visible=e=>e.getClientRects().length>0;
  const identities=[...document.querySelectorAll('a')].filter(e=>visible(e)&&e.href==='https://ads.naver.com/settings/profile-info'&&e.textContent.trim()===viewerId);
  if(identities.length!==1)return 'unverified';
  const pending=u.pathname.endsWith('/inviting');
  const tabs=[...document.querySelectorAll('[role="tab"]')].filter(e=>visible(e)&&e.getAttribute('aria-selected')==='true'&&new RegExp(pending?'^초대 중인 회원(?:\\s|$)':'^권한 받은 회원(?:\\s|$)').test(e.textContent.trim()));
  if(tabs.length!==1)return 'unverified';
  const matches=[...document.querySelectorAll('tr')].filter(visible).map(row=>[...row.querySelectorAll(':scope > td')].map(cell=>cell.innerText.replace(/\s+/g,' ').trim())).filter(cells=>cells.length>=2&&cells[0]==='kitsnode');
  if(matches.length===0)return 'not_found';
  if(matches.length!==1||!/^운영 조회(?:\s+권한 레벨 수정)?$/.test(matches[0][1]))return 'unverified';
  return pending?'pending_observed':'member_observed';
 } catch{return 'unverified';}
}
