// Real local Auth and DB; simulate new protected data after precheck.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseMemberDeleteCandidate} from '../supabase/functions/kitsnode-member-delete/app.mjs';
const path=process.env.KITS_LOCAL_STATUS_FILE;
if(!path?.startsWith('/tmp/kits-supabase-delete.'))throw Error('Local fixture status required');
const env=Object.fromEntries((await readFile(path,'utf8')).split('\n').filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^"|"$/g,'')];}));
if(env.API_URL!=='http://127.0.0.1:54321'||env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres')throw Error('Remote configuration forbidden');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts),auth=createClient(env.API_URL,env.ANON_KEY,opts);
const email=`race-${Date.now()}@example.test`,password='Fixture-pass-9724!';
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;const id=created.data.user.id;
assert.match(id,/^[a-f0-9-]{36}$/i);const login=await auth.auth.signInWithPassword({email,password});if(login.error)throw login.error;
const rpc=admin.rpc.bind(admin),serviceClient={auth:admin.auth,rpc:async(name,args)=>{const result=await rpc(name,args);if(name==='kitsnode_delete_member_precheck'&&result.data===false&&!result.error)execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`INSERT INTO kitsnode_ads_private.attempts(owner_id) VALUES ('${id}'::uuid)`],{env:{...process.env,PGPASSWORD:'postgres'},stdio:'ignore'});return result;}};
const handler=createSupabaseMemberDeleteCandidate({enabled:true,allowedOrigins:['https://heetae1120.github.io'],authClient:auth,serviceClient,allowRequest:async()=>true});
const response=await handler(new Request(env.API_URL+'/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin:'https://heetae1120.github.io',authorization:`Bearer ${login.data.session.access_token}`,'content-type':'application/json'},body:JSON.stringify({confirm:'회원탈퇴'})}));
assert.equal(response.status,503);const user=await admin.auth.admin.getUserById(id);assert.equal(user.error,null);assert.equal(user.data.user.id,id);
process.stdout.write('Local Auth admin deletion refused reference created after precheck.\n');
