import pg from 'pg';

const DELETE_EXPIRED = 'DELETE FROM member_auth_support.oauth_state_claims WHERE expires_at < now()';

// Separate Worker and Hyperdrive binding; never bind the authentication role.
export function createStateCleanupWorker({createClient = connectionString => new pg.Client({connectionString,connectionTimeoutMillis:10000})} = {}) {
  return {
    async scheduled(controller, env) {
      if (controller.cron !== '0 18 * * *' || env?.MEMBER_STATE_CLEANUP_ENABLED !== '1' || typeof env?.MAINTENANCE_HYPERDRIVE?.connectionString !== 'string' || !env.MAINTENANCE_HYPERDRIVE.connectionString) throw new Error('State cleanup unavailable');
      let client;
      try {
        client = createClient(env.MAINTENANCE_HYPERDRIVE.connectionString);
        await client.connect();
        const identity = await client.query("SELECT current_user = 'member_auth_maintenance' AS allowed");
        if (identity.rows[0]?.allowed !== true) throw new Error('Unexpected maintenance role');
        const result = await client.query(DELETE_EXPIRED);
        if (!Number.isInteger(result.rowCount) || result.rowCount < 0) throw new Error('Invalid cleanup result');
        // Only aggregate operational data; never log OAuth state or credentials.
        console.log(JSON.stringify({event:'oauth_state_cleanup',deleted:result.rowCount}));
      } catch {
        throw new Error('State cleanup failed');
      } finally {
        if (client) await Promise.resolve().then(() => client.end()).catch(() => {});
      }
    },
    async fetch() { return new Response(null,{status:404,headers:{'cache-control':'no-store'}}); }
  };
}

export default createStateCleanupWorker();
