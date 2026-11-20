// Default disabled. Service credentials remain server-side; enable only after
// the matching reviewed database migration and release verification.
// @ts-expect-error Deno resolves npm specifiers inside Supabase Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createMemberDeleteHandler} from './handler.mjs';
import {createSupabaseMemberDeleteCandidate} from './app.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const origins=['https://heetae1120.github.io'];
const disabled=createMemberDeleteHandler({enabled:false,allowedOrigins:origins,verifySession:async()=>null,allowRequest:async()=>false,deleteMember:async()=>{throw Error('disabled');}});
let active:ReturnType<typeof createSupabaseMemberDeleteCandidate>|undefined;
function getHandler(){
 if(Deno.env.get('KITS_MEMBER_DELETE_ENABLED')!=='true')return disabled;
 if(active)return active;
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!serviceKey||!anonKey||serviceKey===anonKey)throw Error('invalid_config');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const authClient=createClient(url,anonKey,options),serviceClient=createClient(url,serviceKey,options);
 const allowRequest=async ({userId}:{userId:string})=>{const {data,error}=await serviceClient.rpc('kitsnode_delete_member_limit',{p_user_id:userId});if(error)throw Error('limiter unavailable');return data===true;};
 active=createSupabaseMemberDeleteCandidate({enabled:true,allowedOrigins:origins,authClient,serviceClient,allowRequest});return active;
}
Deno.serve(async req=>{try{return await getHandler()(req);}catch{return new Response(JSON.stringify({error:'unavailable'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});}});
