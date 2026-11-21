// Disabled unless all explicitly configured dependencies are available.
// Configure JWT verification for this public endpoint only after review.
// @ts-ignore Deno resolves npm specifiers in Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createUsernameHandler} from './handler.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(options:{port:number},handler:(request:Request)=>Promise<Response>):void};
const config=()=>{
 const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',origin=Deno.env.get('MEMBER_USERNAME_ALLOWED_ORIGIN')||'',secret=Deno.env.get('MEMBER_USERNAME_LIMIT_KEY')||'';
 const globalLimit=Number(Deno.env.get('MEMBER_USERNAME_GLOBAL_LIMIT')),subjectLimit=Number(Deno.env.get('MEMBER_USERNAME_SUBJECT_LIMIT')),windowSeconds=Number(Deno.env.get('MEMBER_USERNAME_WINDOW_SECONDS'));
 if(!url||!anon||!service||secret.length<32||![globalLimit,subjectLimit,windowSeconds].every(Number.isSafeInteger)||globalLimit<1||subjectLimit<1||windowSeconds<1)throw Error('unavailable');
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const hmac=crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return createUsernameHandler({origin,
  limit:async({kind,username}:{kind:string;username:string})=>{const key=await hmac,bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)),digest=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');const {data,error}=await admin.rpc('kitsnode_consume_username_limit',{p_kind:kind,p_subject_hash:digest,p_global_limit:globalLimit,p_subject_limit:subjectLimit,p_window_seconds:windowSeconds});return !error&&data===true},
  lookup:async(username:string)=>{const {data,error}=await admin.rpc('kitsnode_lookup_email_login',{p_username:username});if(error)throw Error('unavailable');const row=Array.isArray(data)?data[0]:null;return row?{userId:row.user_id,email:row.email}:null},
  login:async(email:string,password:string)=>{const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const {data,error}=await client.auth.signInWithPassword({email,password});return error?null:data},
  revokeSession:async(session:{access_token:string})=>{const {error}=await admin.auth.admin.signOut(session.access_token,'local');if(error)throw Error('revocation_failed')},
  dummyEmail:()=>`no-${crypto.randomUUID()}@example.invalid`,
 });
};
Deno.serve({port:Number(Deno.env.get('PORT')||'8000')},async request=>{try{return await config()(request)}catch{return Response.json({ok:false,code:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}});
