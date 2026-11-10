import pg from 'pg';

// Construct only: pg opens connections lazily. No schema changes or queries.
// A dedicated backend-only role and a verified project CA must be supplied.
export function createSupabasePool({connectionString, ca, Pool = pg.Pool}) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid database configuration'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || !url.pathname || url.pathname === '/' || url.search || url.hash || typeof ca !== 'string' || !ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----') || typeof Pool !== 'function') throw new Error('Invalid database configuration');
  // One connection holds the current-document lock while signup uses another.
  return new Pool({connectionString, ssl:{ca, rejectUnauthorized:true}, options:'-c search_path=member_auth,pg_catalog', max:2, idleTimeoutMillis:10000, connectionTimeoutMillis:10000, allowExitOnIdle:true});
}
