// Explicitly invoked server-only test. Creates only a randomly named synthetic
// user through admin.createUser (no signup/invite email), then removes it.
// No credentials, tokens, email addresses, or exception text are printed.
import {randomBytes,randomUUID} from 'node:crypto';
import {writeFileSync,unlinkSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
if(process.env.KITS_EXPLICIT_AUTH_TEST!=='true')throw Error('explicit test activation required');
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!/^https:\/\/bjpguxwqxlsteektkhwf\.supabase\.co$/.test(url||'')||!key)throw Error('invalid test configuration');
const recovery='/root/kits-shadow-setup/synthetic-auth-test.json';
const marker=randomUUID(),email=`kits-shadow-${marker}@example.invalid`,password=randomBytes(32).toString('base64url');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const member=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let id=null,failed=false,cleaned=false;
writeFileSync(recovery,JSON.stringify({marker,email,userId:null}),{mode:0o600,flag:'wx'});
try{
 const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{kitsShadowTestMarker:marker}});
 if(made.error||!made.data?.user?.id)throw Error('create_failed');
 id=made.data.user.id;writeFileSync(recovery,JSON.stringify({marker,email,userId:id}),{mode:0o600});
 const signed=await member.auth.signInWithPassword({email,password});
 if(signed.error||!signed.data?.session?.access_token||!signed.data?.session?.refresh_token)throw Error('signin_failed');
 const access=signed.data.session.access_token,refresh=signed.data.session.refresh_token;
 const verified=await member.auth.getUser(access);if(verified.error||verified.data?.user?.id!==id)throw Error('getuser_failed');
 const claims=JSON.parse(Buffer.from(access.split('.')[1],'base64url').toString('utf8'));
 if(claims.sub!==id||!/^[0-9a-f-]{36}$/i.test(claims.session_id||''))throw Error('claims_invalid');
 console.log('synthetic-user-created-and-real-jwt-verified');
 const logout=await member.auth.signOut({scope:'global'});if(logout.error)throw Error('signout_failed');
 const after=await member.auth.getUser(access);
 const refreshed=await member.auth.refreshSession({refresh_token:refresh});
 console.log('post-logout-getuser='+(after.error||!after.data?.user?'rejected':'accepted'));
 console.log('post-logout-refresh='+(refreshed.error||!refreshed.data?.session?'rejected':'accepted'));
 if(!refreshed.error&&refreshed.data?.session)throw Error('refresh_not_revoked');
}catch{failed=true;console.log('auth-test-failed');}
finally{
 // If create's response was lost, locate only the unique synthetic marker.
 if(!id){
  try{for(let page=1;page<=100;page++){const r=await admin.auth.admin.listUsers({page,perPage:1000});if(r.error)throw Error();const users=r.data?.users||[];const matches=users.filter(u=>u.email===email&&u.user_metadata?.kitsShadowTestMarker===marker);if(matches.length>1)throw Error();if(matches.length===1){id=matches[0].id;break}if(users.length<1000)break}}catch{failed=true;}
 }
 if(id){
  try{const del=await admin.auth.admin.deleteUser(id);if(del.error)throw Error();const check=await admin.auth.admin.getUserById(id);if(check.error&&check.error.status!==404)throw Error();if(!check.error&&check.data?.user)throw Error();cleaned=true}catch{failed=true;}
 } else cleaned=!failed;
 if(cleaned){try{unlinkSync(recovery)}catch{failed=true}console.log('synthetic-user-cleanup-confirmed');}
 else console.log('cleanup-required-reference='+recovery);
 if(failed)process.exitCode=1;
}
