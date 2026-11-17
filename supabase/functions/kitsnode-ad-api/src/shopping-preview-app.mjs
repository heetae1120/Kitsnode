import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createNaverAdReader} from './naver-ad-read.mjs';
import {createShoppingBindingStore,createShoppingCatalogService} from './shopping-catalog-service.mjs';
import {createShoppingPreviewService} from './shopping-preview-service.mjs';
import {createShoppingPreviewHttp} from './shopping-preview-http.mjs';
import {createShoppingMasterComparison} from './shopping-master-compare.mjs';
import {createShoppingMasterClient} from './shopping-master-report.mjs';
import {createShoppingShadowService,createShoppingShadowStore} from './shopping-shadow-service.mjs';
import {createNaverRankEstimate} from './naver-rank-estimate.mjs';
import {createDualDeviceEstimateService} from './dual-device-estimate-service.mjs';

export function createShoppingPreviewApp({authClient,serviceClient,allowedOrigins,apiKey,secretKey,fetcher=fetch}) {
 const verifySession=createSupabaseSessionVerifier(authClient),memberAllowed=createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver'});
 const listOwned=createSupabaseConnectionStore(serviceClient).listOwned,getBinding=createShoppingBindingStore(serviceClient),allowRequest=createSharedRateLimiter(serviceClient);
 const readerForCustomer=customerId=>createNaverAdReader({apiKey,secretKey,customerId,fetcher});
 const preview=createShoppingPreviewService({verifySession,memberAllowed,getBinding,readerForCustomer});
 const catalog=createShoppingCatalogService({verifySession,memberAllowed,listOwned,getBinding,readerForCustomer});
 const reserveReport=async(userId,connectionId,revision)=>{const {data,error}=await serviceClient.rpc('kits_ads_reserve_master_report',{p_user_id:userId,p_connection_id:connectionId,p_revision:revision});return !error&&data===true};
 const compare=createShoppingMasterComparison({verifySession,memberAllowed,getBinding,reserveReport,readerForCustomer,masterForCustomer:customerId=>createShoppingMasterClient({apiKey,secretKey,customerId,fetcher})});
 const rankEstimate=createDualDeviceEstimateService({verifySession,memberAllowed,getBinding,catalog,estimateForCustomer:customerId=>createNaverRankEstimate({apiKey,secretKey,customerId,fetcher})});
 const shadow=createShoppingShadowService({verifySession,memberAllowed,getBinding,catalog,compare,preview,rankEstimate,store:createShoppingShadowStore(serviceClient)});
 return {handler:createShoppingPreviewHttp({allowedOrigins,verifySession,allowRequest,preview,catalog,compare,shadow,rankEstimate})};
}
