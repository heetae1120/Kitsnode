// Server-only building blocks. No route or database access is installed here.
// An allowlist authorizes only a user whose ID was obtained by getUser(token).
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reference = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const account = v => typeof v === 'string' && /^[1-9][0-9]{0,15}$/.test(v);

export function createOperatorAllowlist(value) {
  // Empty or malformed configuration never grants privilege.
  const parts = typeof value === 'string' && value.trim() ? value.split(',').map(x => x.trim().toLowerCase()) : [];
  if (parts.some(x => !uuid(x)) || new Set(parts).size !== parts.length) throw new TypeError('invalid_operator_allowlist');
  const allowed = new Set(parts);
  return async userId => uuid(userId) && allowed.has(userId.toLowerCase());
}

/**
 * Evidence is retrieved from a private server-owned repository, never from the
 * HTTP request. The independent verifier must authenticate the external proof,
 * its subject and account binding, and reviewer identity; a mere operator
 * assertion or a successful Naver API read is not sufficient. No production
 * implementation of that verifier is supplied, so this alone enables nothing.
 *
 * The eventual atomic approval transaction MUST recheck the evidence revision,
 * validity and revocation along with the connection revision. Without that DB
 * contract, there is a verification-to-commit race and approval must stay off.
 */
export function createOwnershipEvidenceVerifier({evidenceStore, verifyIndependentProof, now=Date.now}) {
  if (typeof evidenceStore?.getByRef !== 'function' || typeof verifyIndependentProof !== 'function' || typeof now !== 'function') throw new TypeError('invalid_dependencies');
  return async ({requestId,userId,adAccountId,evidenceRef,operatorId}={}) => {
    if (![requestId,userId,operatorId].every(uuid) || !account(adAccountId) || !reference(evidenceRef)) return false;
    try {
      const row=await evidenceStore.getByRef(evidenceRef);
      const current=now();
      if (!Number.isFinite(current) || !row || row.ref!==evidenceRef || row.requestId!==requestId || row.userId!==userId || row.adAccountId!==adAccountId || !uuid(row.reviewerId) || row.status!=='verified' || row.revokedAt!=null || !Number.isSafeInteger(row.revision) || row.revision<0 || !reference(row.proofRef) || !reference(row.method) || !Number.isFinite(row.reviewedAt) || !Number.isFinite(row.expiresAt) || row.reviewedAt>current || row.expiresAt<=current || row.expiresAt<=row.reviewedAt) return false;
      // Verifier re-fetches and authenticates proof using server-owned state.
      return await verifyIndependentProof({proofRef:row.proofRef,method:row.method,requestId,userId,adAccountId,reviewerId:row.reviewerId,reviewedAt:row.reviewedAt,expiresAt:row.expiresAt})===true;
    } catch { return false; }
  };
}
