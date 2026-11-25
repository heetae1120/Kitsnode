// This function serves only advertising account connection and manual review.
// Every non-preflight request is authenticated by Supabase Auth getUser and
// review operations additionally require the server-side operator allowlist.
// It does not contain a scheduler or any Naver bid-changing endpoint.
// @ts-ignore Deno resolves npm specifiers inside Supabase Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createConnectionApp} from './src/connection-app.mjs';
import {createReviewApp} from './src/review-app.mjs';
import {createAccountResolver} from './src/naver-account-map.mjs';
import {createShoppingPreviewApp} from './src/shopping-preview-app.mjs';
import {createPerformanceApp} from './src/performance-app.mjs';
import {selectRoute} from './src/select-route.mjs';
declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void};
const origin='https://heetae1120.github.io';
let apps: {connection:ReturnType<typeof createConnectionApp>;review:ReturnType<typeof createReviewApp>}|undefined;
let shopping:ReturnType<typeof createShoppingPreviewApp>|undefined;
let performance:ReturnType<typeof createPerformanceApp>|undefined;
function getApps() {
 if(apps)return apps;
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'',apiKey=Deno.env.get('NAVER_SEARCHAD_API_KEY')||'',secretKey=Deno.env.get('NAVER_SEARCHAD_SECRET_KEY')||'',operators=Deno.env.get('KITS_AD_OPERATOR_IDS')||'';
 if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!serviceKey||!anonKey||serviceKey===anonKey||!apiKey||!secretKey||!operators.trim())throw Error('invalid_config');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const serviceClient=createClient(url,serviceKey,options),authClient=createClient(url,anonKey,options);
 const resolveAccount=createAccountResolver({apiKey,secretKey,principalCustomerId:'4561674'});
 apps={connection:createConnectionApp({authClient,serviceClient,allowedOrigins:[origin],termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver',resolveAccount,verifyOperator:async()=>false,verifyOwnershipEvidence:async()=>false,allowRequest:undefined,requireEmailProfile:true}),review:createReviewApp({authClient,serviceClient,resolveAccount,operatorIds:operators,origin,allowRequest:undefined})};
 return apps;
}
function getShopping(){
 if(shopping)return shopping;
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'',apiKey=Deno.env.get('NAVER_SEARCHAD_API_KEY')||'',secretKey=Deno.env.get('NAVER_SEARCHAD_SECRET_KEY')||'';
 if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!serviceKey||!anonKey||serviceKey===anonKey||!apiKey||!secretKey)throw Error('invalid_config');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 shopping=createShoppingPreviewApp({authClient:createClient(url,anonKey,options),serviceClient:createClient(url,serviceKey,options),allowedOrigins:[origin],apiKey,secretKey,fetcher:fetch,requireEmailProfile:true});return shopping;
}
function getPerformance(){
 if(performance)return performance;
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'',apiKey=Deno.env.get('NAVER_SEARCHAD_API_KEY')||'',secretKey=Deno.env.get('NAVER_SEARCHAD_SECRET_KEY')||'';
 if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!serviceKey||!anonKey||serviceKey===anonKey||!apiKey||!secretKey)throw Error('invalid_config');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 performance=createPerformanceApp({authClient:createClient(url,anonKey,options),serviceClient:createClient(url,serviceKey,options),allowedOrigins:[origin],apiKey,secretKey,fetcher:fetch,requireEmailProfile:true});return performance;
}
Deno.serve(async req=>{
 const fallback=(status:number)=>new Response(JSON.stringify({error:'unavailable'}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 try {
  const u=new URL(req.url),base='/kitsnode-ad-api';const pos=u.pathname.indexOf(base);
  if(pos<0)return fallback(404);
  const route=u.pathname.slice(pos+base.length);
  const selected=selectRoute(route,{getApps,getShopping,getPerformance,performanceEnabled:Deno.env.get('KITS_AD_PERFORMANCE_ENABLED')==='true',shoppingEnabled:Deno.env.get('KITS_SHOPPING_PREVIEW_ENABLED')==='true',shadowEnabled:Deno.env.get('KITS_SHOPPING_SHADOW_ENABLED')==='true'});
  if(!selected)return fallback(404);
  return await selected.handler(new Request(`https://internal.invalid${selected.path}${u.search}`,req));
 } catch {return fallback(503);}
});
