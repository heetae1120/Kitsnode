// Candidate for the observed Naver Ads invitation dialog. No route or session
// broker is attached. Live compatibility and consent handling remain unverified.
const validId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const validAccount = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);

export function createNaverInviteControls({ page, accountId, viewerId, recipientId, authorize = async () => false } = {}) {
  if (!page || !validAccount(accountId) || !validId(viewerId) || !validId(recipientId) || typeof authorize !== 'function') throw TypeError('invalid_configuration');
  let attempted = false;
  async function snapshot() {
    return page.evaluate(({ accountId, viewerId, recipientId }) => {
      const u = new URL(location.href);
      if (u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || u.search || u.hash) return null;
      const visible = e => e.getClientRects().length > 0;
      const profile = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === viewerId && e.href === 'https://ads.naver.com/settings/profile-info');
      if (profile.length !== 1) return null;
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-label="회원 초대"]')].filter(visible);
      if (dialogs.length !== 1) return null;
      const dialog = dialogs[0];
      const text = dialog.innerText.replace(/\s+/g, ' ');
      const inputs = [...dialog.querySelectorAll('input')].filter(e => visible(e) && ['text',''].includes(e.type));
      const buttons = label => [...dialog.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.textContent.trim() === label).length;
      const radios = [...dialog.querySelectorAll('input[type=radio]')].filter(visible);
      const chosen = radios.filter(e => e.checked);
      const role = chosen.length === 1 ? (chosen[0].labels ? [...chosen[0].labels].map(x => x.innerText.trim()).join(' ') : '') : '';
      return { text, inputCount: inputs.length, inputValue: inputs[0]?.value, next: buttons('다음'), lookup: buttons('가입 여부 조회'), invite: buttons('초대'), role, roleCount: radios.length, recipientId };
    }, { accountId, viewerId, recipientId });
  }
  async function clickExact(label) {
    const handle = await page.evaluateHandle(label => {
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-label="회원 초대"]')].filter(e => e.getClientRects().length);
      if (dialogs.length !== 1) return null;
      const hits = [...dialogs[0].querySelectorAll('button')].filter(e => e.getClientRects().length && !e.disabled && e.textContent.trim() === label);
      return hits.length === 1 ? hits[0] : null;
    }, label);
    try { const element = handle.asElement(); if (!element) return false; await element.click(); return true; } finally { await handle.dispose(); }
  }
  async function fillRecipient() {
    const handle = await page.evaluateHandle(() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"][aria-label="회원 초대"]')].filter(e => e.getClientRects().length);
      if (dialogs.length !== 1) return null;
      const hits = [...dialogs[0].querySelectorAll('input')].filter(e => e.getClientRects().length && ['text',''].includes(e.type));
      return hits.length === 1 ? hits[0] : null;
    });
    try { const e = handle.asElement(); if (!e) return false; await e.click({ clickCount: 3 }); await e.press('Backspace'); await e.type(recipientId); return true; } finally { await handle.dispose(); }
  }
  return Object.freeze({
    // User must have personally completed the Naver policy stage first.
    async prepareRecipient() {
      try {
        const s = await snapshot();
        if (!s || !s.text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') || s.inputCount !== 1) return { status:'unverified' };
        if (!await fillRecipient()) return { status:'unverified' };
        const after = await snapshot();
        if (!after || after.inputValue !== recipientId || after.lookup !== 1) return { status:'unverified' };
        if (!await clickExact('가입 여부 조회')) return { status:'unverified' };
        await page.waitForFunction(() => document.body.innerText.includes('초대 가능한 회원 ID입니다.'), { timeout: 5000 });
        const checked = await snapshot();
        if (!checked || checked.inputValue !== recipientId || !checked.text.includes('초대 가능한 회원 ID입니다.') || checked.next !== 1) return { status:'unverified' };
        if (!await clickExact('다음')) return { status:'unverified' };
        return await roleStatus();
      } catch { return { status:'unverified' }; }
    },
    inspectRole: roleStatus,
    async send() {
      if (attempted) return { status:'blocked', retry:'disabled' };
      try {
        if ((await roleStatus()).status !== 'ready' || await authorize({ accountId, viewerId, recipientId, role:'OPERATIONS_MANAGER' }) !== true || (await roleStatus()).status !== 'ready') return { status:'blocked', retry:'disabled' };
        attempted = true;
        if (!await clickExact('초대')) return { status:'uncertain', retry:'disabled' };
        // A click or a toast alone is not enough to prove which invitation was
        // created. Reconcile the destination in Naver before any acceptance.
        return { status:'uncertain', retry:'disabled' };
      } catch { return { status: attempted ? 'uncertain' : 'blocked', retry:'disabled' }; }
    },
  });
  async function roleStatus() {
    const s = await snapshot();
    if (!s || !s.text.includes(`ID ${recipientId} 의 권한 레벨을 선택해 주세요.`) || s.invite !== 1 || s.roleCount !== 2 || s.role !== '운영 관리') return { status:'unverified' };
    return { status:'ready', accountId, recipientId, role:'OPERATIONS_MANAGER' };
  }
}
