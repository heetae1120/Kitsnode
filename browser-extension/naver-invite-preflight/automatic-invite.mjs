// Local trial: this function is serialized into the selected Naver tab.
// It never accepts the policy, submits the final invitation, or reads secrets.
// Every action is bound to one advertising account and visible Naver identity.
export function automaticInviteStep({ action, accountId, viewerId }) {
  const u = new URL(location.href);
  if (!/^[1-9][0-9]{0,15}$/.test(accountId || '') || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId || '') || viewerId === 'kitsnode' ||
      u.origin !== 'https://ads.naver.com' || u.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || u.search || u.hash) return action==='fill'?'fill_url':'unverified';
  // Rectangles alone also exist on fading, inert or aria-hidden dialog trees.
  // Ignore those trees and count one logical dialog for nested containers.
  const visible = e => {
    if(!e.getClientRects().length||e.closest('[aria-hidden="true"],[inert]'))return false;
    for(let node=e;node&&node.nodeType===1;node=node.parentElement){
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;
    }
    return true;
  };
  // Custom-styled inputs may be fully transparent while their visible label is
  // the actual control. Only the input's own opacity is ignored; a hidden
  // ancestor, inaccessible input, disabled input or hidden label is rejected.
  const visibleChoice = e => {
    if(!e.getClientRects().length||e.disabled||e.closest('[aria-hidden="true"],[inert]'))return false;
    for(let node=e;node&&node.nodeType===1;node=node.parentElement){
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||(node!==e&&Number(style.opacity)===0))return false;
    }
    return [...(e.labels||[])].some(label=>visible(label));
  };
  const profiles = [...document.querySelectorAll('a')].filter(e => visible(e) && e.href === 'https://ads.naver.com/settings/profile-info' && e.textContent.trim() === viewerId);
  if (profiles.length !== 1) return action==='fill'?'fill_viewer':'unverified';
  const allDialogs = [...document.querySelectorAll('[role="dialog"][aria-label="회원 초대"]')].filter(visible);
  // Framework wrappers sometimes nest identically labelled role=dialog nodes.
  // Prefer the deepest node only when the other node actually contains it.
  const dialogs = allDialogs.filter(outer=>!allDialogs.some(inner=>inner!==outer&&outer.contains(inner)));
  if (action === 'open') {
    if (dialogs.length === 1 && /\bID\s*kitsnode\s*의\s*권한 레벨을 선택해 주세요\./.test(dialogs[0].innerText.replace(/\s+/g,' '))) return 'role_opened';
    if (dialogs.length === 1 && [...dialogs[0].querySelectorAll('input[type="checkbox"]')].filter(visibleChoice).some(e => [...(e.labels || [])].some(l => l.innerText.includes('개인정보 제공 및 회원 초대 정책에 동의합니다')))) return 'opened';
    if (dialogs.length === 1 && dialogs[0].innerText.replace(/\s+/g,' ').includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') &&
        [...dialogs[0].querySelectorAll('input')].filter(e => visible(e) && (e.type === 'text' || e.type === '')).length === 1) return 'opened';
    const buttons = [...document.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.innerText.trim() === '회원 초대');
    if (dialogs.length === 1) return 'waiting';
    if (dialogs.length > 1) return 'waiting';
    if (buttons.length !== 1) return 'unverified';
    buttons[0].click(); return 'opened';
  }
  // React can temporarily remove the modal while it switches steps. Only an
  // absent dialog is retryable; multiple dialogs remain an ambiguous stop.
  if (dialogs.length === 0) return action==='fill'?'fill_dialog_missing':'waiting';
  // Separate visible dialogs are ambiguous until a transition finishes.
  // Never choose or click between two independent candidates.
  if (dialogs.length !== 1) return action==='fill'?'fill_dialog_wait':'waiting';
  const dialog = dialogs[0];
  const text = dialog.innerText.replace(/\s+/g, ' ').trim();
  const buttons = name => [...dialog.querySelectorAll('button')].filter(e => visible(e) && !e.disabled && e.innerText.trim() === name);
  const inputs = [...dialog.querySelectorAll('input')].filter(e => visible(e) && (e.type === 'text' || e.type === ''));
  if (action === 'policy' || action === 'policy_inspect' || action === 'policy_accept' || action === 'policy_compare') {
    // The advertiser may click Next immediately after checking the policy,
    // before the background controller observes the checked checkbox.
    // Naver's exact recipient-entry screen is then the continuation signal.
    if (text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.') && inputs.length === 1)
      return action === 'policy_inspect' ? 'policy_advanced' : action === 'policy_compare' ? 'unverified' : 'policy_complete';
    const choices = [...dialog.querySelectorAll('input[type="checkbox"]')].filter(visibleChoice).filter(e => [...(e.labels || [])].some(l => l.innerText.includes('개인정보 제공 및 회원 초대 정책에 동의합니다')));
    if (choices.length === 0) return inputs.length > 1 ? 'unverified' : 'waiting';
    if (choices.length !== 1) return 'unverified';
    if (action === 'policy_accept' || action === 'policy_compare') {
      // Independently compare the actual visible Naver notice, not the hash of
      // the separate Kitsnode consent. Unknown markup or changed text stops.
      const expected = [
        '새로운 회원 초대 시 해당 사용자에게 필요한 권한 레벨을 지정하여 계정에 접근 권한 수준을 제한할 수 있습니다.',
        '초대된 회원의 계정 활동 내용에 대한 관리 책임은 모두 초대를 보낸 사용자에게 있으므로 회원 초대 및 관리에 주의해야 합니다.',
        '계정이 유지되는 기간 동안 원활한 계정 운영을 위하여 일부 권한 레벨에게 회원 ID, 광고 계정 ID, 이름, 휴대전화번호, 이메일, 입금 계좌, 환불 계좌가 제공될 수 있으며, 해당 정보는 마스킹 된 상태로 표시됩니다. 본인 인증을 완료한 경우에 한하여 마스킹이 해제됩니다. 본 동의를 거부하실 수 있으나 이 경우 계정 연동 및 회원 참여가 불가합니다. 회원 초대 시 부여하는 권한 레벨에 따라 광고 운영, 결제 권한, 회원 초대 등 모든 관리 및 운영 기능을 사용할 수 있으니 사용자에 맞는 권한 레벨을 지정해 주셔야 합니다.',
        '초대를 받은 사용자가 승인하는 즉시 부여한 권한 레벨로 접근 가능하며, 운영 중인 해당 계정에 대해서 권한 해제 및 권한 레벨을 변경할 수 있습니다.'
      ];
      const actual=[...dialog.querySelectorAll('.ad-cms-modal-body form ul li')].filter(visible).map(e=>e.innerText.replace(/\s+/g,' ').trim());
      const labels=[...(choices[0].labels||[])].filter(visible).map(e=>e.innerText.replace(/\s+/g,' ').trim());
      if(actual.length!==expected.length||actual.some((value,index)=>value!==expected[index])||labels.length!==1||labels[0]!=='위 내용을 숙지하였으며, 개인정보 제공 및 회원 초대 정책에 동의합니다.')return 'policy_changed';
      if (action === 'policy_compare') return 'policy_match';
    }
    if (!choices[0].checked && action === 'policy_accept') { choices[0].click(); return 'waiting'; }
    if (!choices[0].checked) return 'policy_required';
    if (buttons('다음').length !== 1) return 'waiting';
    if (action === 'policy_inspect') return 'policy_confirmed';
    buttons('다음')[0].click(); return 'policy_complete';
  }
  if (action === 'fill') {
    if (!text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.')) return 'fill_prompt_wait';
    if(inputs.length===0)return 'fill_input_wait';
    if(inputs.length!==1)return 'fill_input_ambiguous';
    if (inputs[0].value && inputs[0].value !== 'kitsnode') return 'fill_nonempty';
    // Do not repeatedly fire input/change events while waiting for Naver to
    // enable lookup. Re-emitting the same value can restart debounced form
    // validation indefinitely. A replaced or reset blank field is refilled.
    if (inputs[0].value === 'kitsnode') return 'filled';
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!set) return 'fill_setter';
    set.call(inputs[0], 'kitsnode');
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
    return 'filled';
  }
  if (action === 'lookup') {
    if (inputs.length !== 1) return 'lookup_input_wait';
    if (inputs[0].value === '' && text.includes('회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.')) return 'lookup_refill';
    if (inputs[0].value !== 'kitsnode') return 'unverified';
    if (buttons('가입 여부 조회').length !== 1) return 'lookup_button_wait';
    buttons('가입 여부 조회')[0].click(); return 'lookup_started';
  }
  if (action === 'next') {
    if (inputs.length === 0) return 'waiting';
    if (inputs.length !== 1 || inputs[0].value !== 'kitsnode') return 'unverified';
    if (!text.includes('초대 가능한 회원 ID입니다.') || buttons('다음').length !== 1) return 'waiting';
    buttons('다음')[0].click(); return 'next_started';
  }
  if (action === 'role') {
    if (!/\bID\s*kitsnode\s*의\s*권한 레벨을 선택해 주세요\./.test(text)) return 'waiting';
    const radios = [...dialog.querySelectorAll('input[type="radio"]')].filter(visibleChoice);
    const labeled = radios.map(e=>({element:e,labels:[...(e.labels || [])].map(l=>l.innerText.trim())}));
    if(labeled.some(x=>x.labels.length!==1 || !['운영 관리','운영 조회'].includes(x.labels[0])))return 'unverified';
    if(radios.length<2)return 'waiting';
    const targets = labeled.filter(x=>x.labels[0]==='운영 조회').map(x=>x.element);
    const managers = labeled.filter(x=>x.labels[0]==='운영 관리');
    if (radios.length !== 2 || targets.length !== 1 || managers.length !== 1) return 'unverified';
    // Verify a fresh DOM on a later poll after React processes the click; the
    // transient checked state immediately after .click() is not sufficient.
    if (!targets[0].checked) {targets[0].click();return 'waiting';}
    return targets[0].checked && buttons('초대').length === 1 ? 'ready' : 'waiting';
  }
  return 'unverified';
}

// execute(action, accountId, viewerId) runs exactly one step in the previously
// selected tab and fails closed on tab change/navigation. waitForPolicy must
// wait for the advertiser's interaction, never perform agreement itself.
export async function prepareAutomaticInvite({ execute, waitForPolicy, wait, send, consent, accountId, viewerId, authorizePolicy, onStage = () => {}, maxPolls = 40 }) {
  if (![execute, waitForPolicy, wait].every(f => typeof f === 'function') || !/^[1-9][0-9]{0,15}$/.test(accountId || '') ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerId || '') || viewerId === 'kitsnode' || typeof send !== 'function' ||
      consent?.accountId !== accountId || consent?.recipientId !== 'kitsnode' || consent?.role !== 'OPERATIONS_VIEWER' || consent?.approved !== true ||
      !Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 120) return { status: 'blocked' };
  let sending = false;
  try {
    const step = action => execute(action, accountId, viewerId);
    let opened=await step('open');
    for (let i = 0; opened === 'waiting' && i < maxPolls; i++) { await wait(); opened = await step('open'); }
    if (!['opened','role_opened'].includes(opened)) return {status:'blocked',reason:opened==='waiting'?'open_timeout':'open_unverified'};
    if (opened === 'opened') {
      // Opening the dialog is asynchronous. It may first be absent and only
      // later expose the unchecked policy; handle that state after waiting too.
      let policy = await step('policy');
      for (let i = 0; policy === 'waiting' && i < maxPolls; i++) { await wait(); policy = await step('policy'); }
      if (policy === 'policy_required') {
        onStage('policy');
        // The optional callback is reserved for a trusted adapter that has
        // already atomically consumed account- and policy-bound evidence.
        const preapproved = typeof authorizePolicy === 'function' && await authorizePolicy({accountId,viewerId}) === true;
        if (preapproved) {
          for (let i = 0; i < maxPolls; i++) { policy = await step('policy_accept'); if (policy !== 'waiting') break; await wait(); }
        } else {
          if (await waitForPolicy() !== true) return {status:'policy_required',reason:'policy_unverified'};
          policy = await step('policy');
          for (let i = 0; policy === 'waiting' && i < maxPolls; i++) { await wait(); policy = await step('policy'); }
        }
      }
      if (policy !== 'policy_complete') return {status:'blocked',reason:policy==='waiting'?'policy_timeout':policy==='policy_changed'?'policy_changed':'policy_unverified'};
    // React may replace the input after it was filled. Retry a blank field only;
    // a different nonempty value remains a hard stop rather than being changed.
    onStage('recipient');
    let lookup = 'waiting', lastWait='waiting';
    for (let i = 0; i < maxPolls; i++) {
      const filled = await step('fill');lastWait=filled;
      if (['waiting','fill_dialog_wait','fill_dialog_missing','fill_prompt_wait','fill_input_wait','fill_input_ambiguous'].includes(filled)) { await wait(); continue; }
      if (filled !== 'filled') return {status:'blocked',reason:['tab_changed','binding_expired','tab_navigated','fill_url','fill_viewer','fill_dialog','fill_nonempty','fill_setter'].includes(filled)?filled:'recipient_unverified'};
      lookup = await step('lookup');lastWait=lookup;
      if (lookup === 'lookup_started') break;
      if (!['waiting','refill','lookup_refill','lookup_input_wait','lookup_button_wait'].includes(lookup)) return {status:'blocked',reason:'lookup_unverified'};
      await wait();
    }
      if (lookup !== 'lookup_started') {const reasons={fill_dialog_wait:'fill_dialog',fill_dialog_missing:'recipient_dialog_missing',fill_prompt_wait:'recipient_prompt_timeout',fill_input_wait:'recipient_input_timeout',fill_input_ambiguous:'recipient_input_ambiguous',lookup_refill:'recipient_resets',refill:'recipient_resets',lookup_input_wait:'recipient_input_timeout',lookup_button_wait:'lookup_button_timeout'};return {status:'blocked',reason:reasons[lastWait]||'lookup_timeout'};}
      let next;
      for(let i=0;i<maxPolls;i++){next=await step('next');if(next!=='waiting')break;await wait();}
      if(next!=='next_started')return {status:'blocked',reason:next==='waiting'?'next_timeout':'next_unverified'};
    }
    onStage('role');
    for (const [action, success] of [['role','ready']]) {
      let result;
      for (let i = 0; i < maxPolls; i++) {
        result = await step(action);
        if (result !== 'waiting') break;
        await wait();
      }
      if (result !== success) return {status:'blocked',reason:result==='waiting'?'role_timeout':'role_unverified'};
    }
    // The caller supplies a one-shot sender that must recheck consent, account,
    // recipient and reservation. A click alone does not establish success.
    onStage('send');
    sending = true;
    const outcome=await send({accountId,viewerId,recipientId:'kitsnode',role:'OPERATIONS_VIEWER'});
    // These results are returned before the local attempt is recorded and
    // before the irreversible send invocation. Everything after that point
    // remains uncertain until Naver is independently reconciled.
    if (['blocked','tab_changed','viewer_unverified','role_unverified','unavailable','in_progress','cancelled','previous_attempt'].includes(outcome?.status))
      return {status:'blocked',reason:outcome.status,retry:'disabled'};
    return {status:'uncertain',retry:'disabled'};
  } catch { return sending ? {status:'uncertain',retry:'disabled'} : {status:'blocked',reason:'execution_error'}; }
}
