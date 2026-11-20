// @ts-expect-error Deno resolves npm specifiers in Supabase Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createSelfWithdrawalComposition} from '../kitsnode-member-withdraw/composition.mjs';
import {createSelfIntent} from '../kitsnode-member-withdraw/ledger-intent.mjs';
import {createStaffGateway} from '../kitsnode-member-withdraw/staff-gateway.mjs';
import {createRetryHandler} from './handler.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const env=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('missing_configuration');return value};
let handler:((request:Request)=>Promise<Response>)|undefined;
function configuredHandler(){
 if(handler)return handler;
 const url=env('SUPABASE_URL');if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co')throw Error('invalid_project');
 const supabase=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const intent=createSelfIntent({origin:env('MEMBER_WITHDRAW_LEDGER_URL'),token:env('MEMBER_WITHDRAW_LEDGER_TOKEN')});
 const staff=createStaffGateway({endpoint:env('MEMBER_WITHDRAW_STAFF_ENDPOINT'),secret:env('MEMBER_WITHDRAW_STAFF_TOKEN')});
 handler=createRetryHandler({secret:env('MEMBER_WITHDRAW_RETRY_TOKEN'),intent,withdraw:createSelfWithdrawalComposition({supabase,intent,staff})});
 return handler;
}
Deno.serve(async request=>{try{return await configuredHandler()(request)}catch{return Response.json({error:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}});
