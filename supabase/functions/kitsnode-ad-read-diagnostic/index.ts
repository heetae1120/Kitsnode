// Do not deploy without disabling/removal plan and operator access to the probe.
// Uses the same trusted session verifier and account resolver as the production API.
// @ts-ignore Deno resolves this npm specifier at runtime.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createDiagnostic} from './handler.mjs';
import {createSupabaseSessionVerifier} from '../kitsnode-ad-api/src/connection-http.mjs';
import {createOperatorAllowlist} from '../kitsnode-ad-api/src/operator-evidence.mjs';
import {createSharedRateLimiter} from '../kitsnode-ad-api/src/shared-rate-limit.mjs';
import {createAccountResolver} from '../kitsnode-ad-api/src/naver-account-map.mjs';
declare const Deno: {env:{get(name:string):string|undefined};serve(options:{hostname:string;port:number},handler:(req:Request)=>Promise<Response>):void};
const env=(k:string)=>Deno.env.get(k)||'';
const projectUrl=env('SUPABASE_URL'),anonKey=env('SUPABASE_ANON_KEY'),serviceKey=env('SUPABASE_SERVICE_ROLE_KEY'),apiKey=env('NAVER_SEARCHAD_API_KEY'),secretKey=env('NAVER_SEARCHAD_SECRET_KEY'),operators=env('KITS_AD_OPERATOR_IDS');
if(projectUrl!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!anonKey||!serviceKey||serviceKey===anonKey||!apiKey||!secretKey||!operators.trim())throw Error('invalid_configuration');
const authClient=createClient(projectUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const serviceClient=createClient(projectUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const handler=createDiagnostic({verifySession:createSupabaseSessionVerifier(authClient),verifyOperator:createOperatorAllowlist(operators),allowRequest:createSharedRateLimiter(serviceClient),resolveAccount:createAccountResolver({apiKey,secretKey,principalCustomerId:'4561674'})});
// Local smoke tests can bind loopback explicitly; production keeps Edge's port.
Deno.serve({hostname:'0.0.0.0',port:8000},handler);
