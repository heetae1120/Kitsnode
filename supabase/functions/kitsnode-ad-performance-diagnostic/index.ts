// Independent temporary operator diagnostic, not a general member route.
// @ts-ignore Deno resolves npm specifiers at runtime.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createPerformanceDiagnostic} from './handler.mjs';
import {createSupabaseSessionVerifier} from '../kitsnode-ad-api/src/connection-http.mjs';
import {createOperatorAllowlist} from '../kitsnode-ad-api/src/operator-evidence.mjs';
import {createSharedRateLimiter} from '../kitsnode-ad-api/src/shared-rate-limit.mjs';
import {createNaverAdReader} from '../kitsnode-ad-api/src/naver-ad-read.mjs';
import {createNaverPerformanceReader} from '../kitsnode-ad-api/src/naver-performance-read.mjs';
import {createAccountResolver} from '../kitsnode-ad-api/src/naver-account-map.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const env=(k:string)=>Deno.env.get(k)||'',url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY'),key=env('NAVER_SEARCHAD_API_KEY'),secret=env('NAVER_SEARCHAD_SECRET_KEY'),operators=env('KITS_AD_OPERATOR_IDS');
if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!anon||!service||anon===service||!key||!secret||!operators.trim())throw Error('invalid_configuration');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},auth=createClient(url,anon,options),db=createClient(url,service,options);
Deno.serve(createPerformanceDiagnostic({verifySession:createSupabaseSessionVerifier(auth),verifyOperator:createOperatorAllowlist(operators),allowRequest:createSharedRateLimiter(db),resolveAccount:createAccountResolver({apiKey:key,secretKey:secret,principalCustomerId:'4561674'}),readCampaigns:(customer:string)=>createNaverAdReader({apiKey:key,secretKey:secret,customerId:customer}).campaigns(),readStats:(customer:string,input:{targetId:string,since:string,until:string})=>(createNaverPerformanceReader as any)({apiKey:key,secretKey:secret,customerId:customer}).read(input)}));
