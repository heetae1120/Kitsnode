// Isolated local Supabase: actual repository ad migration and synthetic accounts.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createClient} from '@supabase/supabase-js';
const path=process.env.KITS_LOCAL_STATUS_FILE;if(!path?.startsWith('/tmp/kits-supabase-delete.'))throw Error('Local fixture required');
const env=Object.fromEntries((await readFile(path,'utf8')).split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
if(env.API_URL!=='http://127.0.0.1:54321'||env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres')throw Error('Remote forbidden');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},service=createClient(env.API_URL,env.SERVICE_ROLE_KEY,options);
const suffix=String(Date.now()),password='Fixture-pass-9724!';
async function member(kind){const email=`${kind}-${suffix}@example.test`;const made=await service.auth.admin.createUser({email,password,email_confirm:true});if(made.error)throw made.error;const client=createClient(env.API_URL,env.ANON_KEY,options),login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;return {id:made.data.user.id,client,session:login.data.session};}
async function rpc(name,args){const {data,error}=await service.rpc(name,args);if(error)throw Error(`${name}: ${error.message}`);return data;}
const memberUser=await member('member'),operator=await member('operator'),plain=await member('plain');
const connectionId=randomUUID(),evidenceId=randomUUID(),adAccount='12345678';
assert.equal(await rpc('kits_ads_rate_limit',{p_user_id:memberUser.id}),true);
assert.equal(await rpc('kits_ads_request',{p_request_id:connectionId,p_user_id:memberUser.id,p_ad_account_id:adAccount}),connectionId);
assert.equal((await rpc('kits_ads_list',{p_user_id:memberUser.id})).length,1);
const unregistered=await service.rpc('kits_ads_evidence_record',{p_id:randomUUID(),p_request_id:connectionId,p_operator_id:randomUUID(),p_method:'advertiser_confirmation',p_case_ref:'fixture-case-2'});if(process.env.KITS_EXPECT_UNMAPPED_REJECT==='1')assert.ok(unregistered.error,'unmapped operator is rejected by no-record candidate');else {assert.equal(unregistered.error,null);assert.equal(unregistered.data,true,'existing unmapped operator contract must be preserved');}
assert.equal(await rpc('kits_ads_evidence_record',{p_id:evidenceId,p_request_id:connectionId,p_operator_id:operator.id,p_method:'advertiser_confirmation',p_case_ref:'fixture-case-1'}),true);
assert.equal(await rpc('kits_ads_approve',{p_request_id:connectionId,p_user_id:memberUser.id,p_ad_account_id:adAccount,p_revision:0,p_customer_id:'87654321',p_naver_role:'READ_ONLY',p_operator_id:operator.id,p_evidence_ref:evidenceId}),true);
assert.equal((await rpc('kits_ads_get_binding',{p_request_id:connectionId,p_user_id:memberUser.id}))[0].status,'read_connected');
assert.equal(await rpc('kits_ads_evidence_revoke',{p_request_id:connectionId,p_evidence_id:evidenceId,p_operator_id:operator.id}),true);
assert.equal((await rpc('kits_ads_list',{p_user_id:memberUser.id}))[0].status,'disconnected');
async function deletion(session){return fetch(env.API_URL+'/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin:'https://heetae1120.github.io',apikey:env.ANON_KEY,authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({confirm:'회원탈퇴'})});}
for(const user of [memberUser,operator]){const response=await deletion(user.session);assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'deletion_blocked'});}
assert.equal((await deletion(plain.session)).status,200);
const laterConnection=randomUUID();assert.equal(await rpc('kits_ads_request',{p_request_id:laterConnection,p_user_id:memberUser.id,p_ad_account_id:'12345679'}),laterConnection);
const deletedOperator=await service.rpc('kits_ads_evidence_record',{p_id:randomUUID(),p_request_id:laterConnection,p_operator_id:plain.id,p_method:'advertiser_confirmation',p_case_ref:'fixture-after-deletion'});assert.ok(deletedOperator.error,'new records must not retain a deleted user ID');

// Actual local Storage upload and upsert, with fixture-only RLS policies.
const bucket=`ad-compat-${suffix}`,made=await service.storage.createBucket(bucket,{public:false});if(made.error)throw made.error;
const sql=`CREATE POLICY fixture_insert_${suffix} ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='${bucket}'); CREATE POLICY fixture_select_${suffix} ON storage.objects FOR SELECT TO authenticated USING(bucket_id='${bucket}'); CREATE POLICY fixture_update_${suffix} ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='${bucket}') WITH CHECK(bucket_id='${bucket}');`;
execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{env:{...process.env,PGPASSWORD:'postgres'},stdio:'ignore'});
for(const [content,upsert] of [['first',false],['second',true]]){const result=await memberUser.client.storage.from(bucket).upload('fixture.txt',new Blob([content]),{upsert});if(result.error)throw result.error;}
const stale=await plain.client.storage.from(bucket).upload('after-delete.txt',new Blob(['fixture']));assert.ok(stale.error,'deleted user token must not create new Storage owner data');
process.stdout.write('Repository ad request, evidence, approval, revoke, deletion guards and Storage succeeded.\n');
