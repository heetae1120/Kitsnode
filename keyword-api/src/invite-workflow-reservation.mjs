// Candidate adapter for server-side use with the unapplied test SQL only.
// The caller MUST supply a separately authenticated principal and trustworthy
// request binding; this adapter does not authenticate a user or prove ownership.
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const account = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const outcomes = new Set(['blocked', 'uncertain', 'pending_review']);

export function createInviteWorkflowReservation({store, userId, requestId, accountId, recipientId, advertiserId} = {}) {
  if (!uuid(userId) || !uuid(requestId) || !account(accountId) || !id(recipientId) || !id(advertiserId) || recipientId === advertiserId ||
      !store || !['getJob','reserve','finish'].every(key => typeof store[key] === 'function')) throw TypeError('invalid_configuration');
  let held = false;
  let heldRevision;
  const same = x => x?.requestId === requestId && x.accountId === accountId && x.advertiserId === advertiserId &&
    x.recipientId === recipientId && x.role === 'OPERATIONS_MANAGER';
  return Object.freeze({
    async reserve(expected) {
      if (!same(expected) || held) return false;
      const job = await store.getJob(requestId);
      if (!job || job.userId !== userId || job.adAccountId !== accountId || job.state !== 'pending_review' || job.consent !== true ||
          typeof job.revision !== 'string' || !/^\d+:\d+$/.test(job.revision)) return false;
      // The database rechecks user, account, revision, consent, recipient, role
      // while taking locks, and its unique constraint prevents concurrent replay.
      const reserved = await store.reserve({requestId,userId,adAccountId:accountId,revision:job.revision,recipientId,role:'OPERATIONS_MANAGER'});
      if (reserved !== true) return false;
      held = true;
      heldRevision = job.revision;
      return true;
    },
    // Rechecks the database snapshot, not the identity of the browser user.
    // The caller must combine this with fresh authentication and ownership
    // checks. A revocation after this read can race an external click.
    async isCurrent(expected) {
      if (!held || !same(expected)) return false;
      const job = await store.getJob(requestId);
      return Boolean(job && job.userId === userId && job.adAccountId === accountId &&
        job.state === 'pending_review' && job.consent === true && job.revision === heldRevision);
    },
    async finish(expected) {
      if (!held || !same(expected) || !outcomes.has(expected.outcome)) return false;
      // Supabase store throws if persistence is unconfirmed. A returned false
      // from another implementation is also an explicit failure.
      const finished = await store.finish(requestId, expected.outcome);
      if (finished === false) return false;
      held = false;
      return true;
    },
  });
}
