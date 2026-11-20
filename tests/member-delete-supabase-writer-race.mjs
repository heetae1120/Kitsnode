// Synthetic local Supabase only: ad write starts before auth admin deletion.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';import {createClient} from '@supabase/supabase-js';
const path=process.env.KITS_LOCAL_STATUS_FILE;if(!path?.startsWith('/tmp/kits-supabase-delete.'))throw Error('Local fixture required');
const env=Object.fromEntries((await readFile(path,'utf8')).split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
if(env.API_URL!=='http://127.0.0.1:54321'||env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres')throw Error('Remote forbidden');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts),client=createClient(env.API_URL,env.ANON_KEY,opts);
const email=`race-writer-${Date.now()}@example.test`,password='Fixture-pass-9724!';const made=await admin.auth.admin.createUser({email,password,email_confirm:true});if(made.error)throw made.error;const id=made.data.user.id;assert.match(id,/^[a-f0-9-]{36}$/i);
const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
const sql=`BEGIN; INSERT INTO kitsnode_ads_private.request_limits(user_id,window_started_at,attempts) VALUES ('${id}',now(),1); SELECT pg_sleep(2); COMMIT;`;
const child=spawn('/opt/homebrew/opt/postgresql@17/bin/psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{env:{...process.env,PGPASSWORD:'postgres'},stdio:'ignore'});
const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('fixture writer failed')));});
await new Promise(resolve=>setTimeout(resolve,300));
const response=await fetch(env.API_URL+'/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin:'https://heetae1120.github.io',apikey:env.ANON_KEY,authorization:`Bearer ${login.data.session.access_token}`,'content-type':'application/json'},body:JSON.stringify({confirm:'회원탈퇴'})});
await done;const user=await admin.auth.admin.getUserById(id);
assert.notEqual(response.status,200,'a committed new reference must prevent deletion');assert.equal(user.error,null,'referenced user must remain');
process.stdout.write('In-flight ad writer prevents concurrent user deletion.\n');
