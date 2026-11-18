// Local trial: this function is serialized into the selected Naver tab.
// It never accepts the policy, submits the final invitation, or reads secrets.
// Every action is bound to one advertising account and visible Naver identity.
export function automaticInviteStep({ action, accountId, viewerId }) {
  const u = new URL(location.href);
  if (!/^[1-9][0-9]{0,15}$/.test(accountId || '') || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId || '') || viewerId === 'kitsnode' ||
      u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || u.search || u.hash) return 'unverified';
  const visible = e => e.getClientRects().length > 0;
  const profiles = [...document.querySelectorAll('a')].filter(e => visible(e) && e.href === 'https://ads.naver.com/settings/profile-info' && e.textContent.trim() === viewerId);
  if (profiles.length !== 1) return 'unverified';
  const dialogs = [...document.querySelectorAll('[role="dialog"][aria-label="회원 초대"]')].filter(visible);
  if (action === 'open') {
    if (dialogs.length === 1 && /\bID\s*kitsnode\s*의\s*권한 레벨을 선택해 주세요\./.test(dialogs[0].innerText.replace(/\s+/g,' '))) return 'role_opened';
    if (dialogs.length === 1 && [...dialogs[0].querySelectorAll('input[type="checkbox"]')].filter(visible).some(e => [...(e.labels || [])].some(l => l.innerText.includes('개인정보 제공 및 회원 초대 정책에 동의합니다')))) return 'opened';
    if (dialogs.length === 1 && dialogs[0].innerText.replace(/\s+/g,' ').includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') &&
        [...dialogs[0].querySelectorAll('input')].filter(e => visible(e) && (e.type === 'text' || e.type === '')).length === 1) return 'opened';
    const buttons = [...document.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.innerText.trim() === '회원 초대');
    if (dialogs.length || buttons.length !== 1) return 'unverified';
    buttons[0].click(); return 'opened';
  }
  if (dialogs.length !== 1) return 'unverified';
  const dialog = dialogs[0];
  const text = dialog.innerText.replace(/\s+/g, ' ').trim();
  const buttons = name => [...dialog.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.innerText.trim() === name);
  const inputs = [...dialog.querySelectorAll('input')].filter(e => visible(e) && (e.type === 'text' || e.type === ''));
  if (action === 'policy' || action === 'policy_inspect') {
    // The advertiser may click Next immediately after checking the policy,
    // before the background controller observes the checked checkbox.
    // Naver's exact recipient-entry screen is then the continuation signal.
    if (text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') && inputs.length === 1)
      return action === 'policy_inspect' ? 'policy_advanced' : 'policy_complete';
    const choices = [...dialog.querySelectorAll('input[type="checkbox"]')].filter(visible).filter(e => [...(e.labels || [])].some(l => l.innerText.includes('개인정보 제공 및 회원 초대 정책에 동의합니다')));
    if (choices.length !== 1) return 'unverified';
    if (!choices[0].checked) return 'policy_required';
    if (buttons('다음').length !== 1) return 'waiting';
    if (action === 'policy_inspect') return 'policy_confirmed';
    buttons('다음')[0].click(); return 'policy_complete';
  }
  if (action === 'fill') {
    if (!text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') || inputs.length !== 1) return 'waiting';
    if (inputs[0].value && inputs[0].value !== 'kitsnode') return 'unverified';
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!set) return 'unverified';
    set.call(inputs[0], 'kitsnode');
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    return 'filled';
  }
  if (action === 'lookup') {
    if (inputs.length !== 1) return 'waiting';
    if (inputs[0].value === '' && text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.')) return 'refill';
    if (inputs[0].value !== 'kitsnode') return 'unverified';
    if (buttons('가입 여부 조회').length !== 1) return 'waiting';
    buttons('가입 여부 조회')[0].click(); return 'lookup_started';
  }
  if (action === 'next') {
    if (inputs.length !== 1 || inputs[0].value !== 'kitsnode') return 'unverified';
    if (!text.includes('초대 가능한 회원 ID입니다.') || buttons('다음').length !== 1) return 'waiting';
    buttons('다음')[0].click(); return 'next_started';
  }
  if (action === 'role') {
    if (!/\bID\s*kitsnode\s*의\s*권한 레벨을 선택해 주세요\./.test(text)) return 'waiting';
    const radios = [...dialog.querySelectorAll('input[type="radio"]')].filter(visible);
    const targets = radios.filter(e => [...(e.labels || [])].some(l => l.innerText.trim() === '운영 관리'));
    if (radios.length !== 2 || targets.length !== 1) return 'unverified';
    if (!targets[0].checked) targets[0].click();
    return targets[0].checked && buttons('초대').length === 1 ? 'ready' : 'waiting';
  }
  return 'unverified';
}

// execute(action, accountId, viewerId) runs exactly one step in the previously
// selected tab and fails closed on tab change/navigation. waitForPolicy must
// wait for the advertiser's interaction, never perform agreement itself.
export async function prepareAutomaticInvite({ execute, waitForPolicy, wait, send, consent, accountId, viewerId, maxPolls = 20 }) {
  if (![execute, waitForPolicy, wait].every(f => typeof f === 'function') || !/^[1-9][0-9]{0,15}$/.test(accountId || '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId || '') || viewerId === 'kitsnode' || typeof send !== 'function' ||
      consent?.accountId !== accountId || consent?.recipientId !== 'kitsnode' || consent?.role !== 'OPERATIONS_MANAGER' || consent?.approved !== true ||
      !Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 120) return { status: 'blocked' };
  let sending = false;
  try {
    const step = action => execute(action, accountId, viewerId);
    const opened=await step('open');
    if (!['opened','role_opened'].includes(opened)) return {status:'blocked'};
    if (opened === 'opened') {
      let policy = await step('policy');
      if (policy === 'policy_required') {
        if (await waitForPolicy() !== true) return {status:'policy_required'};
        policy = await step('policy');
      }
      for (let i = 0; policy === 'waiting' && i < maxPolls; i++) { await wait(); policy = await step('policy'); }
      if (policy !== 'policy_complete') return {status:'blocked'};
    // React may replace the input after it was filled. Retry a blank field only;
    // a different nonempty value remains a hard stop rather than being changed.
    let lookup = 'waiting';
    for (let i = 0; i < maxPolls; i++) {
      const filled = await step('fill');
      if (filled === 'waiting') { await wait(); continue; }
      if (filled !== 'filled') return {status:'blocked'};
      lookup = await step('lookup');
      if (lookup === 'lookup_started') break;
      if (!['waiting','refill'].includes(lookup)) return {status:'blocked'};
      await wait();
    }
      if (lookup !== 'lookup_started') return {status:'blocked'};
      let next;
      for(let i=0;i<maxPolls;i++){next=await step('next');if(next!=='waiting')break;await wait();}
      if(next!=='next_started')return {status:'blocked'};
    }
    for (const [action, success] of [['role','ready']]) {
      let result;
      for (let i = 0; i < maxPolls; i++) {
        result = await step(action);
        if (result !== 'waiting') break;
        await wait();
      }
      if (result !== success) return {status:'blocked'};
    }
    // The caller supplies a one-shot sender that must recheck consent, account,
    // recipient and reservation. A click alone does not establish success.
    sending = true;
    const outcome=await send({accountId,viewerId,recipientId:'kitsnode',role:'OPERATIONS_MANAGER'});
    // These results are returned before the local attempt is recorded and
    // before the irreversible send invocation. Everything after that point
    // remains uncertain until Naver is independently reconciled.
    if (['blocked','tab_changed','viewer_unverified','role_unverified','unavailable','in_progress','cancelled','previous_attempt'].includes(outcome?.status))
      return {status:'blocked',reason:outcome.status,retry:'disabled'};
    return {status:'uncertain',retry:'disabled'};
  } catch { return sending ? {status:'uncertain',retry:'disabled'} : {status:'blocked'}; }
}
