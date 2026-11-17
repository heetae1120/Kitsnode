import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createNaverAdReader} from './naver-ad-read.mjs';
import {createShoppingBindingStore,createShoppingCatalogService} from './shopping-catalog-service.mjs';
import {createShoppingPreviewService} from './shopping-preview-service.mjs';
import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';

export function createShoppingPreviewApp({authClient,serviceClient,allowedOrigins,apiKey,secretKey,fetcher=fetch}) {
 const verifySession=createSupabaseSessionVerifier(authClient),memberAllowed=createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver'});
 const listOwned=createSupabaseConnectionStore(serviceClient).listOwned,getBinding=createShoppingBindingStore(serviceClient),allowRequest=createSharedRateLimiter(serviceClient);
 const readerForCustomer=customerId=>createNaverAdReader({apiKey,secretKey,customerId,fetcher});
 const preview=createShoppingPreviewService({verifySession,memberAllowed,getBinding,readerForCustomer});
 const catalog=createShoppingCatalogService({verifySession,memberAllowed,listOwned,getBinding,readerForCustomer});
 return {handler:createShoppingPreviewHttp({allowedOrigins,verifySession,allowRequest,preview,catalog})};
}
