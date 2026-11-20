// Isolated local Supabase integration only. Never accepts remote URLs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const path=process.env.KITS_LOCAL_STATUS_FILE;
if(!path?.startsWith('/tmp/kits-supabase-delete.'))throw Error('Local fixture status required');
const env=Object.fromEntries((await readFile(path,'utf8')).split('\n').filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^"|"$/g,'')];}));
if(env.API_URL!=='http://127.0.0.1:54321'||env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres')throw Error('Remote configuration forbidden');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts);
const db=sql=>execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tA','-c',sql],{env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'}).trim();
const pass='Fixture-pass-9724!';
async function create(email){const {data,error}=await admin.auth.admin.createUser({email,password:pass,email_confirm:true});if(error)throw error;return data.user;}
async function signIn(email){const client=createClient(env.API_URL,env.ANON_KEY,opts);const {data,error}=await client.auth.signInWithPassword({email,password:pass});if(error)throw error;return {client,session:data.session};}
async function remove(session){return fetch(env.API_URL+'/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin:'https://heetae1120.github.io',apikey:env.ANON_KEY,authorization:`Bearer ${session.access_token}`,'content-type':'application/json'},body:JSON.stringify({confirm:'회원탈퇴'})});}
const suffix=String(Date.now());const email=kind=>`${kind}-${suffix}@example.test`;
const normal=await create(email('normal')),staff=await create(email('staff')),storage=await create(email('storage')),ads=await create(email('ads')),attempt=await create(email('attempt')),evidence=await create(email('evidence')),limit=await create(email('limit'));
for(const id of [normal.id,staff.id,storage.id,ads.id,attempt.id,evidence.id,limit.id])assert.match(id,/^[0-9a-f-]{36}$/i);
db(`INSERT INTO kits_ai_private.staff(user_id) VALUES ('${staff.id}'); INSERT INTO public.kitsnode_member_consents(user_id) VALUES ('${normal.id}'); INSERT INTO kitsnode_ads_private.connections(user_id) VALUES ('${ads.id}'); INSERT INTO kitsnode_ads_private.attempts(owner_id) VALUES ('${attempt.id}'); INSERT INTO kitsnode_ads_private.ownership_evidence(user_id) VALUES ('${evidence.id}'); INSERT INTO kitsnode_ads_private.request_limits(user_id) VALUES ('${limit.id}'); CREATE TABLE IF NOT EXISTS public.fixture_jwt(user_id uuid NOT NULL); ALTER TABLE public.fixture_jwt ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT ON public.fixture_jwt TO authenticated; INSERT INTO public.fixture_jwt VALUES ('${normal.id}');`);
const bucketName=`fixture-${suffix}`;const bucket=await admin.storage.createBucket(bucketName,{public:false});if(bucket.error)throw bucket.error;
db(`CREATE POLICY fixture_upload_${suffix} ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='${bucketName}'); DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fixture_jwt' AND policyname='fixture_user') THEN CREATE POLICY fixture_user ON public.fixture_jwt FOR SELECT TO authenticated USING (user_id=auth.uid()); END IF; END $$; DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fixture_jwt' AND policyname='fixture_insert') THEN CREATE POLICY fixture_insert ON public.fixture_jwt FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid()); END IF; END $$;`);
const normalSession=await signIn(email('normal')),staffSession=await signIn(email('staff')),storageSession=await signIn(email('storage')),adsSession=await signIn(email('ads')),attemptSession=await signIn(email('attempt')),evidenceSession=await signIn(email('evidence')),limitSession=await signIn(email('limit'));
const upload=await storageSession.client.storage.from(bucketName).upload('fixture.txt',new Blob(['synthetic fixture'],{type:'text/plain'}));if(upload.error)throw upload.error;
const staffResponse=await remove(staffSession.session);assert.equal(staffResponse.status,409,'shared staff member must not be removed');
const adsResponse=await remove(adsSession.session);assert.equal(adsResponse.status,409,'ad connection owner must not be removed');
for(const session of [attemptSession.session,evidenceSession.session,limitSession.session])assert.equal((await remove(session)).status,409,'unlinked advertising owner must not be removed');
const storageResponse=await remove(storageSession.session);assert.equal(storageResponse.status,409,'storage owner must not be removed');
const response=await remove(normalSession.session);assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:true});
const verified=await admin.auth.admin.getUserById(normal.id);assert.ok(verified.error);
const oldSession=await normalSession.client.auth.getUser(normalSession.session.access_token);assert.ok(oldSession.error);
assert.equal(db(`SELECT count(*) FROM public.kitsnode_member_consents WHERE user_id='${normal.id}'`),'0');
assert.equal(db(`SELECT count(*) FROM auth.sessions WHERE user_id='${normal.id}'`),'0');
const staleJwt=await normalSession.client.from('fixture_jwt').select('user_id');assert.equal(staleJwt.error,null);assert.equal(staleJwt.data.length,1,'unexpired JWT remains valid on ordinary RLS APIs');
const staleInsert=await normalSession.client.from('fixture_jwt').insert({user_id:normal.id});assert.equal(staleInsert.error,null,'unexpired JWT can recreate a row where no session/FK check exists');
const staleUpload=await normalSession.client.storage.from(bucketName).upload('after-deletion.txt',new Blob(['fixture']));assert.ok(staleUpload.error,'storage owner guard must prevent creation after deletion');
assert.equal(db(`SELECT count(*) FROM kits_ai_private.staff WHERE user_id='${staff.id}'`),'1');
assert.equal(db(`SELECT count(*) FROM kitsnode_ads_private.connections WHERE user_id='${ads.id}'`),'1');
assert.equal(db(`SELECT count(*) FROM kitsnode_ads_private.attempts WHERE owner_id='${attempt.id}'`),'1');
assert.equal(db(`SELECT count(*) FROM kitsnode_ads_private.ownership_evidence WHERE user_id='${evidence.id}'`),'1');
assert.equal(db(`SELECT count(*) FROM kitsnode_ads_private.request_limits WHERE user_id='${limit.id}'`),'1');
assert.equal(db(`SELECT count(*) FROM storage.objects WHERE owner_id='${storage.id}' OR owner='${storage.id}'::uuid`),'1');
// Verify each known FK-free owner/actor reference independently through the
// real local Auth and Edge function (not just via direct database calls).
for(const schema of ['kitsnode_ads_private','kitsnode_ads_test_20261117']) {
 for(const [table,column] of [['attempts','owner_id'],['ownership_evidence','user_id'],['request_limits','user_id'],['connections','approved_by'],['ownership_evidence','recorded_by'],['ownership_evidence','revoked_by']]) {
  const memberEmail=`ref-${schema==='kitsnode_ads_private'?'a':'b'}-${table}-${column}-${suffix}@example.test`;
  const member=await create(memberEmail);assert.match(member.id,/^[a-f0-9-]{36}$/i);
  db(`INSERT INTO ${schema}.${table}(${column}) VALUES ('${member.id}')`);
  const current=await signIn(memberEmail),result=await remove(current.session);
  assert.equal(result.status,409,`${schema}.${table}.${column}`);assert.deepEqual(await result.json(),{error:'deletion_blocked'});
 }
}
process.stdout.write('Local Auth, Edge, PostgREST, deletion, staff, ads, Storage and stale JWT verified.\n');
