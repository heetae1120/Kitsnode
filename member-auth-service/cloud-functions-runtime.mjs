import {parseRuntimeConfig} from './runtime-config.mjs';
import {createSupabasePool} from './supabase-pool.mjs';
import {createProductionMemberHandler} from './production-runtime.mjs';
import {createCloudFunctionsAdapter} from './cloud-functions-adapter.mjs';
import {createSharedRateLimit,withSharedRateLimit} from './shared-rate-limit.mjs';

// Explicit initialization by a deployment entrypoint; never reads event fields as configuration.
// This candidate is not an enabled Cloud Functions entrypoint. Real gateway cookie
// behavior, shared rate limits and DB roles/schema must be verified before exposure.
export async function createCloudFunctionsRuntime(env, deps = {}) {
  const config=parseRuntimeConfig(env);
  const pool=(deps.createPool || createSupabasePool)(config.database);
  try {
    const handle=await (deps.createHandler || createProductionMemberHandler)({...config,database:pool,pool});
    const check=(deps.createRateLimit || createSharedRateLimit)({pool});
    const action=(deps.createAdapter || createCloudFunctionsAdapter)({origin:config.authOrigin,handle:withSharedRateLimit(handle,check,config.frontendOrigins)});
    return {action,close:()=>pool.end()};
  } catch (error) {
    await pool.end();
    throw error;
  }
}
