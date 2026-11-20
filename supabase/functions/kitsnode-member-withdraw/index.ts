// @ts-expect-error Deno resolves npm specifiers in Supabase Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createSelfWithdrawalHandler} from './handler.mjs';
import {createSelfWithdrawalComposition} from './composition.mjs';
import {createSelfIntent} from './ledger-intent.mjs';
import {createStaffGateway} from './staff-gateway.mjs';
import {withdrawalEnabledFor} from './release-gate.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('missing_configuration');return value};
let handler:((request:Request)=>Promise<Response>)|undefined;
function configuredHandler(){
 if(handler)return handler;
 const url=env('SUPABASE_URL');if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co')throw Error('invalid_project');
 const service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');if(service===anon)throw Error('invalid_auth');
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const supabase=createClient(url,service,opts),authClient=createClient(url,anon,opts);
 const intent=createSelfIntent({origin:env('MEMBER_WITHDRAW_LEDGER_URL'),token:env('MEMBER_WITHDRAW_LEDGER_TOKEN')});
 const staff=createStaffGateway({endpoint:env('MEMBER_WITHDRAW_STAFF_ENDPOINT'),secret:env('MEMBER_WITHDRAW_STAFF_TOKEN')});
 const withdraw=createSelfWithdrawalComposition({supabase,intent,staff});
 handler=createSelfWithdrawalHandler({origin:'https://heetae1120.github.io',verifyUser:async(token:string)=>{const {data,error}=await authClient.auth.getUser(token);return error||!withdrawalEnabledFor(data.user?.id,{release:Deno.env.get('MEMBER_WITHDRAW_RELEASE'),testSubject:Deno.env.get('MEMBER_WITHDRAW_TEST_SUBJECT')})?null:data.user},withdraw});
 return handler;
}
Deno.serve(async request=>{try{return await configuredHandler()(request)}catch{return Response.json({error:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}});
