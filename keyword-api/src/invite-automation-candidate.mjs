// Local candidate only. No route, provider implementation, or production wiring.
// The repository must atomically reserve a job against the supplied snapshot and
// permanently reject subsequent reservations, including after process failures.
export function createInviteAutomationCandidate({ enabled = false, recipientId, role, auth, repository, identity, provider }) {
  const validConfig = typeof recipientId === 'string' && recipientId.length > 0 && role === 'OPERATIONS_MANAGER';
  const matches = (job, userId) => Boolean(job && job.userId === userId && job.state === 'pending_review' &&
    job.consent === true && typeof job.adAccountId === 'string' && job.adAccountId.length > 0 &&
    typeof job.revision === 'string' && job.revision.length > 0);
  const evidenceMatches = (value, expected) => Boolean(value && value.verified === true &&
    value.adAccountId === expected.adAccountId && value.recipientId === recipientId && value.role === role &&
    typeof value.invitationId === 'string' && value.invitationId.length > 0);

  return async function run(input) {
    if (!enabled || !validConfig) return { status: 'disabled' };
    if (!input || Object.keys(input).sort().join(',') !== 'requestId,token' ||
      typeof input.requestId !== 'string' || !input.requestId || typeof input.token !== 'string' || !input.token) {
      return { status: 'blocked' };
    }
    let reserved = false;
    let outcome = 'blocked';
    try {
      const session = await auth.verify(input.token);
      if (!session || !session.userId || !session.sessionBinding) return { status: 'blocked' };
      const job = await repository.getJob(input.requestId);
      if (!matches(job, session.userId)) return { status: 'blocked' };
      const expected = { requestId: input.requestId, userId: session.userId, adAccountId: job.adAccountId,
        revision: job.revision, recipientId, role };
      const verified = await identity.verify({ ...expected, sessionBinding: session.sessionBinding });
      if (verified !== true) return { status: 'blocked' };
      // Must atomically check consent, ownership, job revision and reserve the job.
      reserved = await repository.reserve(expected) === true;
      if (!reserved) return { status: 'blocked' };
      const stillAuthorized = async () => {
        const currentSession = await auth.verify(input.token);
        const current = await repository.getJob(input.requestId);
        return Boolean(currentSession && currentSession.userId === expected.userId &&
          currentSession.sessionBinding === session.sessionBinding && matches(current, expected.userId) &&
          current.adAccountId === expected.adAccountId && current.revision === expected.revision &&
          await identity.verify({ ...expected, sessionBinding: session.sessionBinding }) === true);
      };
      if (await stillAuthorized()) {
        outcome = 'uncertain'; // A crash, exception or ambiguous result must never be retried automatically.
        const invitation = await provider.invite({ ...expected });
        if (evidenceMatches(invitation, expected)) {
          // An invitation now exists even if authorization is withdrawn or
          // cannot be checked before acceptance. Keep the conservative status
          // so callers know an external change may require reconciliation.
          if (await stillAuthorized()) {
            outcome = 'uncertain';
            const accepted = await provider.accept({ ...expected, invitationId: invitation.invitationId });
            if (evidenceMatches(accepted, expected) && accepted.invitationId === invitation.invitationId) {
              // Access is not independent proof of advertiser ownership.
              outcome = 'pending_review';
            }
          }
        }
      }
    } catch {
      // Before reservation there has been no provider call. Afterwards, keep a
      // conservative outcome if an operation may have happened.
      if (!reserved) return { status: 'blocked' };
    }
    try {
      // Persist only minimal status; the reserve remains consumed even on failure.
      if (await repository.finish(input.requestId, outcome) === false) throw Error('audit_unconfirmed');
    } catch {
      return { status: 'audit_unconfirmed', retry: 'disabled' };
    }
    return { status: outcome, retry: 'disabled' };
  };
}
