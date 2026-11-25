import {createSupabaseSessionVerifier,createConnectionHttp} from './connection-http.mjs';
import {createConnectionService} from './connection-service.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';

// Explicit composition root. Privileged dependencies must be created only in a
// server process; no browser route is mounted by importing this module.
export function createConnectionApp({authClient,serviceClient,allowedOrigins,termsVersion,privacyVersion,resolveAccount,verifyOperator,verifyOwnershipEvidence,allowRequest,requireEmailProfile=false}) {
 const verifySession=createSupabaseSessionVerifier(authClient);
 const store=createSupabaseConnectionStore(serviceClient);
 const memberAllowed=createMemberEligibility(serviceClient,{termsVersion,privacyVersion,requireEmailProfile});
 const limiter=allowRequest ?? createSharedRateLimiter(serviceClient);
 const service=createConnectionService({verifySession,verifyOperator,verifyOwnershipEvidence,resolveAccount,store});
 return {handler:createConnectionHttp({allowedOrigins,verifySession,memberAllowed,allowRequest:limiter,service,listOwned:store.listOwned}),service};
}
