import { createHash } from 'node:crypto';

// A pg-compatible pool is supplied by the eventual runtime; this module never
// connects to a database, creates a schema, or supplies credentials itself.
export function createPostgresSupport(pool) {
  if (!pool || typeof pool.query !== 'function') throw new Error('Postgres query adapter required');
  const validVersion = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 128;
  const validUser = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 256;
  const digestPattern = /^[0-9a-f]{64}$/;

  return {
    // Each version binds to exactly one immutable text digest, including on
    // concurrent startup. Do not store or log the supplied terms text.
    async registerTerms({version, text}) {
      if (!validVersion(version) || typeof text !== 'string' || !text.trim()) throw new Error('Terms configuration required');
      const digest = createHash('sha256').update(text, 'utf8').digest('hex');
      const result = await pool.query(`INSERT INTO member_auth_support.terms (version,digest) VALUES ($1,$2)
        ON CONFLICT (version) DO UPDATE SET digest = member_auth_support.terms.digest
        WHERE member_auth_support.terms.digest = EXCLUDED.digest RETURNING version`, [version,digest]);
      if (result.rows.length !== 1) throw new Error('Terms version already has different text');
    },
    async hasAccepted({userId, version}) {
      if (!validUser(userId) || !validVersion(version)) return false;
      const result = await pool.query('SELECT 1 FROM member_auth_support.consents WHERE user_id = $1 AND version = $2', [userId,version]);
      return result.rows.length === 1;
    },
    async recordAcceptance({userId, version}) {
      if (!validUser(userId) || !validVersion(version)) throw new Error('Invalid consent identity');
      await pool.query('INSERT INTO member_auth_support.consents (user_id,version) VALUES ($1,$2) ON CONFLICT (user_id,version) DO NOTHING', [userId,version]);
    },
    // Digest is one-way state hash. A 24h retention window exceeds current
    // 10-minute Better Auth state expiry; cleanup must happen only after this
    // window. Unique primary key provides atomicity between server instances.
    async claimState(digest) {
      if (typeof digest !== 'string' || !digestPattern.test(digest)) return false;
      const result = await pool.query("INSERT INTO member_auth_support.oauth_state_claims (digest,expires_at) VALUES ($1,now() + interval '24 hours') ON CONFLICT (digest) DO NOTHING RETURNING digest", [digest]);
      return result.rows.length === 1;
    },
    // Run from a controlled maintenance job, never from a callback hot path.
    async pruneExpiredClaims() {
      const result = await pool.query('DELETE FROM member_auth_support.oauth_state_claims WHERE expires_at < now()');
      return result.rowCount ?? result.affectedRows ?? 0;
    },
  };
}
