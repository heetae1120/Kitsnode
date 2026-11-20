// Synthetic-only local Auth/Storage and candidate ad-write trigger compatibility.
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {createClient} from '@supabase/supabase-js';
const path=process.env.KITS_LOCAL_STATUS_FILE;if(!path?.startsWith('/tmp/kits-supabase-delete.'))throw Error('Local fixture required');
const env=Object.fromEntries((await readFile(path,'utf8')).split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
if(env.API_URL!=='http://127.0.0.1:54321'||env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres')throw Error('Remote forbidden');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts),auth=createClient(env.API_URL,env.ANON_KEY,opts);
const suffix=String(Date.now()),email=`compat-${suffix}@example.test`,password='Fixture-pass-9724!';
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;const id=created.data.user.id;assert.match(id,/^[a-f0-9-]{36}$/i);
const login=await auth.auth.signInWithPassword({email,password});if(login.error)throw login.error;
const db=sql=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA','-c',sql],{env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'}).trim();
for(const schema of ['kitsnode_ads_private','kitsnode_ads_test_20261117'])for(const [table,col] of [['attempts','owner_id'],['ownership_evidence','user_id'],['request_limits','user_id'],['connections','approved_by'],['ownership_evidence','recorded_by'],['ownership_evidence','revoked_by']]){db(`INSERT INTO ${schema}.${table}(${col}) VALUES ('${id}'); UPDATE ${schema}.${table} SET ${col}=${col} WHERE ${col}='${id}';`);assert.equal(db(`SELECT count(*) FROM ${schema}.${table} WHERE ${col}='${id}'`),'1');}
const bucket=`compat-${suffix}`;const result=await admin.storage.createBucket(bucket,{public:false});if(result.error)throw result.error;
db(`CREATE POLICY compat_insert_${suffix} ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='${bucket}'); CREATE POLICY compat_select_${suffix} ON storage.objects FOR SELECT TO authenticated USING(bucket_id='${bucket}'); CREATE POLICY compat_update_${suffix} ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='${bucket}') WITH CHECK(bucket_id='${bucket}');`);
const first=await auth.storage.from(bucket).upload('fixture.txt',new Blob(['first']));if(first.error)throw first.error;
const second=await auth.storage.from(bucket).upload('fixture.txt',new Blob(['updated']),{upsert:true});if(second.error)throw second.error;
const files=await auth.storage.from(bucket).list();if(files.error)throw files.error;assert.equal(files.data.length,1);
process.stdout.write('Normal fixture ad writes and Storage upload/upsert succeeded.\n');
