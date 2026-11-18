// Server-only candidate, not attached to an HTTP route or live Naver provider.
// The recipient is application configuration, never a field supplied by a
// browser. Replacing this identity requires a reviewed server code change.
import { createInviteAutomationCandidate } from './invite-automation-candidate.mjs';

export const KITSNODE_INVITE_RECIPIENT = 'kitsnode';
export const KITSNODE_INVITE_ROLE = 'OPERATIONS_MANAGER';

export function createKitsnodeInviteService({ enabled = false, auth, repository, identity, provider } = {}) {
  return createInviteAutomationCandidate({
    enabled: enabled === true,
    recipientId: KITSNODE_INVITE_RECIPIENT,
    role: KITSNODE_INVITE_ROLE,
    auth, repository, identity, provider,
  });
}
