// Feature-gated candidate. Opening a Naver tab
// does not constitute authentication, account selection, or invitation.
const extensionIdPattern = /^[a-p]{32}$/;
export async function startAdvertiserLogin({extensionId, runtime, crypto: random, consent} = {}) {
  if (consent !== true || !extensionIdPattern.test(extensionId || '') || typeof runtime?.sendMessage !== 'function' || typeof random?.randomUUID !== 'function') return {status:'unavailable'};
  const nonce = random.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)) return {status:'unavailable'};
  try {
    const response = await runtime.sendMessage(extensionId, {type:'kitsnode.open-advertiser-login.v1',nonce,consent:true});
    return response?.status === 'opened' && response.nonce === nonce ? {status:'opened'} : {status:'unavailable'};
  } catch { return {status:'unavailable'}; }
}

// This only guards the local tab-opening action against an account change.
// It does not send a token to the extension or authorize an invitation.
export async function startAdvertiserLoginForMember({getSession, currentUserId, isCurrent, start = startAdvertiserLogin, ...options} = {}) {
  if (typeof getSession !== 'function' || typeof currentUserId !== 'string' || !currentUserId || typeof isCurrent !== 'function' || typeof start !== 'function') return {status:'unavailable'};
  try {
    const result = await getSession();
    const session = result?.data?.session;
    if (typeof session?.access_token !== 'string' || !session.access_token || session?.user?.id !== currentUserId || isCurrent(currentUserId) !== true) return {status:'unavailable'};
    const opened = await start(options);
    if (isCurrent(currentUserId) !== true) return {status:'unavailable'};
    return opened?.status === 'opened' ? {status:'opened'} : {status:'unavailable'};
  } catch { return {status:'unavailable'}; }
}
