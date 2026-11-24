import {createSupabaseSessionVerifier} from './connection-http.mjs';
import {createMemberEligibility} from './member-eligibility.mjs';
import {createSharedRateLimiter} from './shared-rate-limit.mjs';
import {createSupabaseConnectionStore} from './supabase-connection-store.mjs';
import {createNaverAdReader} from './naver-ad-read.mjs';
import {createShoppingBindingStore,createShoppingCatalogService} from './shopping-catalog-service.mjs';
import {createHourlyPerformanceCandidate} from './hourly-performance-candidate.mjs';
import {createNaverPerformanceReader} from './naver-performance-read.mjs';
import {createPerformanceService} from './performance-service.mjs';
import {createPerformanceHttp} from './performance-http.mjs';

export function createPerformanceApp({authClient,serviceClient,allowedOrigins,apiKey,secretKey,fetcher=fetch,requireEmailProfile=false}) {
 const verifySession=createSupabaseSessionVerifier(authClient);
 const memberAllowed=createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver',requireEmailProfile});
 const listOwned=createSupabaseConnectionStore(serviceClient).listOwned,getBinding=createShoppingBindingStore(serviceClient),allowRequest=createSharedRateLimiter(serviceClient);
 const readerForCustomer=customerId=>createNaverAdReader({apiKey,secretKey,customerId,fetcher});
 const catalog=createShoppingCatalogService({verifySession,memberAllowed,listOwned,getBinding,readerForCustomer});
 const readPerformance=createPerformanceService({verifySession,memberAllowed,getBinding,catalog,statsForCustomer:customerId=>createNaverPerformanceReader({apiKey,secretKey,customerId,fetcher})});
 const readHourly=createPerformanceService({verifySession,memberAllowed,getBinding,catalog,hourly:true,statsForCustomer:customerId=>createHourlyPerformanceCandidate({apiKey,secretKey,customerId,fetcher})});
 return {handler:createPerformanceHttp({allowedOrigins,verifySession,allowRequest,readPerformance}),hourlyHandler:createPerformanceHttp({allowedOrigins,verifySession,allowRequest,readPerformance:readHourly,path:'/api/performance-hourly'})};
}
