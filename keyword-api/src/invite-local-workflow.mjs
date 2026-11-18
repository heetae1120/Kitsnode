// Interactive local candidate only: no production route or remote login transport.
// Reservation and evidence providers must be independent, durable implementations;
// the supplied UI candidates alone cannot prove that an invitation was created.
import { openLocalInviteSessions } from './invite-local-session-bridge.mjs';
import { prepareNaverInviteDialog } from './naver-invite-dialog.mjs';
import { createNaverInviteControls } from './naver-invite-controls.mjs';
import { createNaverAcceptControls } from './naver-accept-controls.mjs';
import { verifyNaverRecipientSession } from './naver-recipient-session.mjs';

const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const account = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);
const evidenceMatches = (e, expected, status) => e?.verified === true && e.status === status &&
  e.requestId === expected.requestId && e.accountId === expected.accountId &&
  e.advertiserId === expected.advertiserId && e.recipientId === expected.recipientId && e.role === 'OPERATIONS_MANAGER' &&
  typeof e.invitationId === 'string' && e.invitationId.length > 0;

export async function runLocalInviteWorkflow({ requestId, accountId, advertiserId, recipientId,
  puppeteer, executablePath, onWindowReady, onPolicyReview, authorize, reservation, evidence,
  openSessions = openLocalInviteSessions, prepareDialog = prepareNaverInviteDialog,
  createInvite = createNaverInviteControls, createAccept = createNaverAcceptControls,
  verifyRecipient = verifyNaverRecipientSession } = {}) {
  if (!id(requestId) || !account(accountId) || !id(advertiserId) || !id(recipientId) || advertiserId === recipientId ||
      ![onWindowReady,onPolicyReview,authorize,reservation?.reserve,reservation?.finish,evidence?.pending,evidence?.accepted,
        openSessions,prepareDialog,createInvite,createAccept,verifyRecipient].every(x => typeof x === 'function')) throw TypeError('invalid_configuration');
  const expected = {requestId,accountId,advertiserId,recipientId,role:'OPERATIONS_MANAGER'};
  let sessions, reserved = false, result = {status:'blocked',retry:'disabled'};
  try {
    sessions = await openSessions({puppeteer,executablePath,onWindowReady});
    if (!sessions?.advertiser || !sessions?.recipient || sessions.advertiser === sessions.recipient || typeof sessions.close !== 'function') return result;
    if (await verifyRecipient({page:sessions.recipient,recipientId}) !== true) return result;
    if ((await prepareDialog({page:sessions.advertiser,accountId,viewerId:advertiserId}))?.status !== 'dialog_open_requested') return result;
    // The person reviews and completes the Naver policy screen directly.
    if (await onPolicyReview({page:sessions.advertiser,...expected}) !== true) return result;
    const invite = createInvite({page:sessions.advertiser,accountId,viewerId:advertiserId,recipientId,authorize});
    if ((await invite.prepareRecipient())?.status !== 'ready') return result;
    // Must atomically consume this request before any external mutation.
    reserved = await reservation.reserve(expected) === true;
    if (!reserved) return result;
    result = {status:'uncertain',retry:'disabled'};
    const sent = await invite.send();
    // Once a provider method was called, a malformed/blocked response does not
    // prove that no side effect occurred. Preserve the uncertain audit outcome.
    if (sent?.status !== 'uncertain') return result;
    // UI click responses are ambiguous. Do not accept unless a trusted source
    // proves the exact pending invitation independently of the click result.
    const pending = await evidence.pending({...expected,sessions});
    if (!evidenceMatches(pending,expected,'pending')) return result;
    const accept = createAccept({page:sessions.recipient,accountId,recipientId,authorize});
    const accepted = await accept.accept();
    // The invitation already exists even if acceptance stops before its click.
    if (accepted?.status !== 'uncertain') return result;
    const final = await evidence.accepted({...expected,invitationId:pending.invitationId,sessions});
    if (evidenceMatches(final,expected,'accepted') && final.invitationId === pending.invitationId) {
      // Does not replace independent advertiser ownership review.
      result = {status:'pending_review',retry:'disabled'};
    }
    return result;
  } catch {
    return result;
  } finally {
    if (reserved) {
      try { if (await reservation.finish({...expected,outcome:result.status}) !== true) throw Error('unconfirmed'); }
      catch { result.status = 'audit_unconfirmed'; }
    }
    if (typeof sessions?.close === 'function') { try { await sessions.close(); } catch {} }
  }
}
