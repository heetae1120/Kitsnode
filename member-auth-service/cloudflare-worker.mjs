import pg from 'pg';
import {parseRuntimeConfig} from './runtime-config.mjs';
import {createProductionMemberHandler} from './production-runtime.mjs';
import bundledTerms from './bundled-terms.mjs';
import {verifyBundledTerms} from './terms-bundle.mjs';
import {createEdgeRateLimits} from './edge-rate-limit.mjs';

// Candidate only: deploy after verifying that the Hyperdrive origin uses a
// dedicated role with search_path=member_auth,pg_catalog and caching disabled.
// Hyperdrive pools in transaction mode: session SET is not a security boundary.
export function createCloudflareWorker(deps={}) {
  // Signup keeps one lock connection while Better Auth uses another.
  const createPool=deps.createPool || (connectionString=>new pg.Pool({connectionString,max:2,connectionTimeoutMillis:10000}));
  const build=deps.createHandler || createProductionMemberHandler;
  const termsBundle=deps.termsBundle === undefined ? bundledTerms : deps.termsBundle;
  return { async fetch(request,env) {
    let pool;
    try {
      if (env?.MEMBER_HYPERDRIVE_SCHEMA_VERIFIED !== '1' || typeof env?.HYPERDRIVE?.connectionString !== 'string' || !env.HYPERDRIVE.connectionString) throw new Error('unavailable');
      // Database TLS is terminated by Hyperdrive, which must use verify-full to
      // the Supabase origin. The shared config's direct-DB fields are unused.
      const termsText=verifyBundledTerms(termsBundle?.terms,env.MEMBER_TERMS_VERSION,env.MEMBER_TERMS_SHA256);
      const privacyText=verifyBundledTerms(termsBundle?.privacy,env.MEMBER_PRIVACY_VERSION,env.MEMBER_PRIVACY_SHA256);
      const config=parseRuntimeConfig({...env,MEMBER_TERMS_TEXT:termsText,MEMBER_PRIVACY_TEXT:privacyText,MEMBER_DATABASE_URL:'postgresql://placeholder.invalid/unused',MEMBER_DATABASE_CA:'unused'});
      if (new URL(request.url).origin !== config.authOrigin) return new Response(null,{status:404});
      // Preflight must not initialize auth or write terms to the database.
      if (request.method === 'OPTIONS') {
        const origin=request.headers.get('origin');
        const method=request.headers.get('access-control-request-method');
        if (!origin || !config.frontendOrigins.includes(origin) || !['GET','POST'].includes(method)) return Response.json({error:'origin_not_allowed'},{status:403,headers:{'cache-control':'no-store'}});
        return new Response(null,{status:204,headers:{'vary':'Origin','cache-control':'no-store','access-control-allow-origin':origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'}});
      }
      let edge;
      if (env.MEMBER_EDGE_LIMITS_ENABLED === '1') {
        // A per-location emergency circuit breaker also caps distributed IPs.
        // It is intentionally distinct from the per-IP and account budgets.
        if (typeof env.MEMBER_SITE_LIMIT?.limit !== 'function') throw new Error('Site limit unavailable');
        if ((await env.MEMBER_SITE_LIMIT.limit({key:'auth-site'})).success !== true) return Response.json({error:'rate_limited'},{status:429,headers:{'cache-control':'no-store','retry-after':'60'}});
        edge=createEdgeRateLimits({ipLimiter:env.MEMBER_IP_LIMIT,accountLimiter:env.MEMBER_ACCOUNT_LIMIT,secret:env.MEMBER_RATE_LIMIT_SECRET});
        if (!await edge.ip(request)) return Response.json({error:'rate_limited'},{status:429,headers:{'cache-control':'no-store','retry-after':'60'}});
      } else throw new Error('Edge limits are required');
      pool=createPool(env.HYPERDRIVE.connectionString);
      // IP and verified-session account limits run before relevant work.
      // Do not use the former global DB bucket: one client could exhaust it for all.
      const handle=await build({...config,database:pool,pool,accountLimit:edge.account,cloudflareClientIP:true});
      return await handle(request);
    } catch {
      return Response.json({error:'unavailable'},{status:503,headers:{'cache-control':'no-store'}});
    } finally {
      if(pool) {
        // A stalled socket must not prevent a response from reaching the client.
        let timer;
        try { await Promise.race([Promise.resolve().then(()=>pool.end()).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,deps.closeTimeoutMs ?? 1500)})]); }
        finally { if(timer) clearTimeout(timer); }
      }
    }
  }};
}
export default createCloudflareWorker();
