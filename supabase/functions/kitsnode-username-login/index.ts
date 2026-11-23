// Disabled unless all explicitly configured dependencies are available.
// Configure JWT verification for this public endpoint only after review.
// @ts-ignore Deno resolves npm specifiers in Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createUsernameHandler} from './handler.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(options:{port:number},handler:(request:Request)=>Promise<Response>):void};
const config=()=>{
 const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',origin='https://heetae1120.github.io';
 if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!anon||!service||anon===service)throw Error('unavailable');
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return createUsernameHandler({origin,
  limit:async({kind,username}:{kind:string;username:string})=>{const {data,error}=await admin.rpc('kitsnode_consume_username_limit_auto',{p_kind:kind,p_username:username});return !error&&data===true},
  lookup:async(username:string)=>{const {data,error}=await admin.rpc('kitsnode_lookup_email_login',{p_username:username});if(error)throw Error('unavailable');const row=Array.isArray(data)?data[0]:null;return row?{userId:row.user_id,email:row.email}:null},
  login:async(email:string,password:string)=>{const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const {data,error}=await client.auth.signInWithPassword({email,password});return error?null:data},
  revokeSession:async(session:{access_token:string})=>{const {error}=await admin.auth.admin.signOut(session.access_token,'local');if(error)throw Error('revocation_failed')},
  dummyEmail:()=>`no-${crypto.randomUUID()}@example.invalid`,
 });
};
Deno.serve({port:Number(Deno.env.get('PORT')||'8000')},async request=>{try{return await config()(request)}catch{return Response.json({ok:false,code:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}});
