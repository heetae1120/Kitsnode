// Local trial only: Web Locks coordinate extension contexts in one browser
// profile. They are not a substitute for a durable, cross-device reservation.
// Read-only diagnosis for the currently selected tab; this never clicks the
// invite button or changes stored state.
export async function inspectInvite({chromeApi,execute}) {
 try {
  const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});const tab=tabs.length===1?tabs[0]:null;
  const u=new URL(tab?.url), match=u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
  if(!match||!Number.isInteger(tab?.id))return 'blocked';
  const viewer=await execute(chromeApi,'viewer',tab.url,tab.id);
  if(typeof viewer!=='string'||!/^viewer:[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewer))return 'viewer_unverified';
  if(await execute(chromeApi,'inspect_send',tab.url,tab.id,viewer.slice(7))!=='ready')return 'role_unverified';
  const key=`invite_attempt_${match[1]}_kitsnode`;
  if((await chromeApi.storage.local.get(key))[key])return 'previous_attempt';
  return 'ready';
 } catch{return 'unavailable';}
}
export async function sendInvite({ chromeApi, execute, confirmAction, locks }) {
  if (!locks || typeof locks.request !== 'function') return 'unavailable';
  const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const tab = tabs.length === 1 ? tabs[0] : null;
  let match;
  try {
    const u = new URL(tab?.url);
    if (u.origin === 'https://ads.naver.com' && !u.search && !u.hash) match = u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/settings\/authorities\/members\/invited$/);
  } catch {}
  if (!match || !Number.isInteger(tab?.id)) return 'blocked';
  const url = tab.url, tabId = tab.id, key = `invite_attempt_${match[1]}_kitsnode`;
  return locks.request(key, { ifAvailable: true }, async lock => {
    if (!lock) return 'in_progress';
    const viewerResult = await execute(chromeApi, 'viewer', url, tabId);
    if (typeof viewerResult !== 'string' || !/^viewer:[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(viewerResult)) return 'viewer_unverified';
    const viewerId = viewerResult.slice(7);
    if (await execute(chromeApi, 'inspect_send', url, tabId, viewerId) !== 'ready') return 'role_unverified';
    if ((await chromeApi.storage.local.get(key))[key]) return 'previous_attempt';
    if (!await confirmAction({ accountId: match[1], recipientId: 'kitsnode', viewerId })) return 'cancelled';
    // Persist before the external side effect. A failed write must not click.
    await chromeApi.storage.local.set({ [key]: { attemptedAt: Date.now() } });
    try { await execute(chromeApi, 'send', url, tabId, viewerId); } catch {}
    // Even a successful click does not establish Naver's resulting state.
    return 'uncertain';
  });
}
