// Scoped to the signed-in user by database RLS. This is not an employee role.
export const MEMBER_TERMS_VERSION = '2026-11-14';
export const MEMBER_PRIVACY_VERSION = '2026-11-14';

// An asynchronous insert for an old session must never unlock a new account.
export function bindConsentToUser(consent, userId, currentUserId) {
  if (!userId || typeof currentUserId !== 'function') throw new TypeError('invalid_consent_user');
  return async evidence => {
    if (currentUserId() !== userId) return {ok:false,code:'session_changed'};
    const result = await consent.accept(evidence);
    return currentUserId() === userId ? result : {ok:false,code:'session_changed'};
  };
}

export function createMemberConsent(client) {
  if (!client || typeof client.from !== 'function') throw new TypeError('invalid_consent_client');
  async function hasCurrent() {
    try {
      const {data, error} = await client.from('kitsnode_member_consents')
        .select('terms_version,privacy_version,accepted_at')
        .eq('terms_version', MEMBER_TERMS_VERSION)
        .eq('privacy_version', MEMBER_PRIVACY_VERSION).maybeSingle();
      if (error) return {ok:false,code:'unavailable'};
      return {ok:true,accepted:Boolean(data && data.accepted_at)};
    } catch { return {ok:false,code:'unavailable'}; }
  }
  async function accept(evidence) {
    if (evidence?.termsAccepted !== true || evidence?.privacyAcknowledged !== true ||
        evidence?.termsVersion !== MEMBER_TERMS_VERSION || evidence?.privacyVersion !== MEMBER_PRIVACY_VERSION)
      return {ok:false,code:'invalid_input'};
    try {
      const {error} = await client.from('kitsnode_member_consents').insert({
        terms_version:MEMBER_TERMS_VERSION, privacy_version:MEMBER_PRIVACY_VERSION,
      });
      if (error && error.code !== '23505') return {ok:false,code:'unavailable'};
      const result = await hasCurrent();
      return result.ok && result.accepted ? {ok:true,code:'consent_recorded'} : {ok:false,code:'unavailable'};
    } catch { return {ok:false,code:'unavailable'}; }
  }
  async function withdraw(userId) {
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)) return {ok:false,code:'invalid_input'};
    try {
      const {error} = await client.from('kitsnode_member_consents').delete().eq('user_id',userId);
      if (error) return {ok:false,code:'unavailable'};
      // Confirm all versions for this user were removed, not just the current
      // version: earlier records can remain if a delete was incomplete.
      const remaining = await client.from('kitsnode_member_consents')
        .select('user_id').eq('user_id',userId).limit(1);
      return !remaining.error && Array.isArray(remaining.data) && remaining.data.length === 0
        ? {ok:true,code:'consent_withdrawn'} : {ok:false,code:'unavailable'};
    } catch { return {ok:false,code:'unavailable'}; }
  }
  return {hasCurrent,accept,withdraw};
}
