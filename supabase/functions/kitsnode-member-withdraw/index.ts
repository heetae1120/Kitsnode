// @ts-ignore Deno resolves npm specifiers in Supabase Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createSelfWithdrawalHandler} from './handler.mjs';
import {createDirectWithdrawal} from './direct-service.mjs';
import {createAdminProtection} from './admin-protection.mjs';
import {withdrawalEnabledFor} from './release-gate.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('missing_configuration');return value};
let handler:((request:Request)=>Promise<Response>)|undefined;
let handlerOperators:string|undefined;
function configuredHandler(){
 const operators=Deno.env.get('KITS_AD_OPERATOR_IDS')||'';
 if(handler&&handlerOperators===operators)return handler;
 const url=env('SUPABASE_URL');if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co')throw Error('invalid_project');
 const service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');if(service===anon)throw Error('invalid_auth');
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const supabase=createClient(url,service,opts),authClient=createClient(url,anon,opts);
 if(Deno.env.get('MEMBER_WITHDRAW_CUSTOMER_DIRECT_ENABLED')!=='true')throw Error('disabled');
 const isProtected=createAdminProtection({operatorIds:operators});
 const withdraw=createDirectWithdrawal({supabase,readOperators:()=>Deno.env.get('KITS_AD_OPERATOR_IDS')||''});
 handler=createSelfWithdrawalHandler({isProtected,origin:'https://heetae1120.github.io',verifyUser:async(token:string)=>{const {data,error}=await authClient.auth.getUser(token);return error||!withdrawalEnabledFor(data.user?.id,{release:Deno.env.get('MEMBER_WITHDRAW_RELEASE'),testSubject:Deno.env.get('MEMBER_WITHDRAW_TEST_SUBJECT')})?null:data.user},withdraw});
 handlerOperators=operators;
 return handler;
}
Deno.serve(async request=>{try{return await configuredHandler()(request)}catch{return Response.json({error:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}});
