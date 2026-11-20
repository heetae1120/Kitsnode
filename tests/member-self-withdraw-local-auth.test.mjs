import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
const url=process.env.KITS_LOCAL_AUTH_URL, serviceKey=process.env.KITS_LOCAL_AUTH_SERVICE_KEY,anonKey=process.env.KITS_LOCAL_AUTH_ANON_KEY;
test('local Supabase Auth deletes email credentials and allows a clean re-registration', {skip:!url||!serviceKey||!anonKey}, async()=>{
 assert.equal(url,'http://127.0.0.1:55421','test refuses any non-isolated server');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
 const admin=createClient(url,serviceKey,options),browser=createClient(url,anonKey,options);
 const email=`self-withdraw-${crypto.randomUUID()}@example.test`,password='Local-test-only-234!';let firstId,secondId;
 try {
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);firstId=created.data.user.id;
  const signed=await browser.auth.signInWithPassword({email,password});assert.ifError(signed.error);const oldAccess=signed.data.session.access_token;
  const removed=await admin.auth.admin.deleteUser(firstId);assert.ifError(removed.error);
  assert.ok((await browser.auth.getUser(oldAccess)).error);
  assert.ok((await browser.auth.signInWithPassword({email,password})).error);
  const registered=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(registered.error);secondId=registered.data.user.id;assert.notEqual(firstId,secondId);
  const newLogin=await browser.auth.signInWithPassword({email,password});assert.ifError(newLogin.error);assert.equal(newLogin.data.user.id,secondId);
 }finally{if(secondId)await admin.auth.admin.deleteUser(secondId);if(firstId)await admin.auth.admin.deleteUser(firstId)}
});

test('self-withdrawal Supabase adapter bans and deletes a real local Auth account', {skip:!url||!serviceKey||!anonKey}, async()=>{
 assert.equal(url,'http://127.0.0.1:55421','test refuses any non-isolated server');
 const {createSelfSupabaseAdapter}=await import('../supabase/functions/kitsnode-member-withdraw/supabase-adapter.mjs');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
 const admin=createClient(url,serviceKey,options),browser=createClient(url,anonKey,options);
 const email=`self-withdraw-adapter-${crypto.randomUUID()}@example.test`,password='Local-test-only-234!';let id;
 try {
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);id=created.data.user.id;
  const oldLogin=await browser.auth.signInWithPassword({email,password});assert.ifError(oldLogin.error);
  const client={auth:admin.auth,rpc:async(_,p)=>({data:({reserve:'reserved',stop_ads:'stopped',cleanup_ads:'cleaned',cleanup_staff:'cleaned',cleanup_sessions:'sessions_removed',verify:'cleaned'})[p.p_step],error:null})};
  const adapter=createSelfSupabaseAdapter(client),ctx={subject:id,requestId:crypto.randomUUID()};
  assert.equal(await adapter.blockAccess(ctx),true);assert.ok((await browser.auth.signInWithPassword({email,password})).error);
  assert.equal(await adapter.cleanupDatabase(ctx),true);assert.equal(await adapter.deleteAuth(ctx),true);assert.equal(await adapter.verifyDatabase(ctx),true);
  assert.ok((await browser.auth.getUser(oldLogin.data.session.access_token)).error);
 }finally{if(id)await admin.auth.admin.deleteUser(id)}
});

test('local data API denies an already issued token once withdrawal is blocked', {skip:!url||!serviceKey||!anonKey}, async()=>{
 assert.equal(url,'http://127.0.0.1:55421','test refuses any non-isolated server');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
 const admin=createClient(url,serviceKey,options),browser=createClient(url,anonKey,options);
 const email=`self-withdraw-rls-${crypto.randomUUID()}@example.test`,password='Local-test-only-234!';let id;
 try {
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);id=created.data.user.id;
  const signed=await browser.auth.signInWithPassword({email,password});assert.ifError(signed.error);
  const inserted=await browser.from('withdraw_test_records').insert({value:'private'});assert.ifError(inserted.error);
  const before=await browser.from('withdraw_test_records').select('value');assert.ifError(before.error);assert.equal(before.data.length,1);
  const blocked=await admin.rpc('withdraw_test_block',{p_user:id});assert.ifError(blocked.error);
  const after=await browser.from('withdraw_test_records').select('value');assert.ifError(after.error);assert.equal(after.data.length,0);
  assert.ok((await browser.from('withdraw_test_records').insert({value:'blocked'})).error);
 }finally{if(id)await admin.auth.admin.deleteUser(id)}
});

test('local Supabase adapter removes member consent, advertising and staff references before account deletion', {skip:!url||!serviceKey||!anonKey}, async()=>{
 assert.equal(url,'http://127.0.0.1:55421','test refuses any non-isolated server');
 const {createSelfSupabaseAdapter}=await import('../supabase/functions/kitsnode-member-withdraw/supabase-adapter.mjs');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}};
 const admin=createClient(url,serviceKey,options),password='Local-test-only-234!';let id,otherId;
 try {
  const first=await admin.auth.admin.createUser({email:`self-all-${crypto.randomUUID()}@example.test`,password,email_confirm:true});assert.ifError(first.error);id=first.data.user.id;
  const second=await admin.auth.admin.createUser({email:`other-all-${crypto.randomUUID()}@example.test`,password,email_confirm:true});assert.ifError(second.error);otherId=second.data.user.id;
  assert.ifError((await admin.rpc('withdraw_test_seed',{p_user:id})).error);assert.ifError((await admin.rpc('withdraw_test_seed',{p_user:otherId})).error);
  const adapter=createSelfSupabaseAdapter(admin),ctx={subject:id,requestId:crypto.randomUUID()};
  assert.equal(await adapter.blockAccess(ctx),true);assert.equal(await adapter.stopAds(ctx),'stopped');assert.equal(await adapter.cleanupDatabase(ctx),true);
  assert.equal(await adapter.deleteAuth(ctx),true);assert.equal(await adapter.verifyDatabase(ctx),true);
  const other=await admin.auth.admin.getUserById(otherId);assert.ifError(other.error);assert.equal(other.data.user.id,otherId);
 }finally{if(id)await admin.auth.admin.deleteUser(id);if(otherId){const otherAdapter=createSelfSupabaseAdapter(admin),ctx={subject:otherId,requestId:crypto.randomUUID()};await otherAdapter.blockAccess(ctx);await otherAdapter.stopAds(ctx);await otherAdapter.cleanupDatabase(ctx);await otherAdapter.deleteAuth(ctx)}}
});

test('local Auth deletion removes a synthetic Naver identity and permits re-linking to a new account', {skip:!url||!serviceKey||!anonKey}, async()=>{
 assert.equal(url,'http://127.0.0.1:55421','test refuses any non-isolated server');
 const options={auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}},admin=createClient(url,serviceKey,options);
 const providerId='local-naver-'+crypto.randomUUID(),password='Local-test-only-234!';let first,second;
 try {
  const a=await admin.auth.admin.createUser({email:`naver-first-${crypto.randomUUID()}@example.test`,password,email_confirm:true});assert.ifError(a.error);first=a.data.user.id;
  assert.ifError((await admin.rpc('withdraw_test_seed_naver',{p_user:first,p_provider_id:providerId})).error);
  assert.equal((await admin.rpc('withdraw_test_naver_count',{p_provider_id:providerId})).data,1);
  assert.ifError((await admin.auth.admin.deleteUser(first)).error);
  assert.equal((await admin.rpc('withdraw_test_naver_count',{p_provider_id:providerId})).data,0);
  const b=await admin.auth.admin.createUser({email:`naver-second-${crypto.randomUUID()}@example.test`,password,email_confirm:true});assert.ifError(b.error);second=b.data.user.id;assert.notEqual(first,second);
  assert.ifError((await admin.rpc('withdraw_test_seed_naver',{p_user:second,p_provider_id:providerId})).error);
  assert.equal((await admin.rpc('withdraw_test_naver_count',{p_provider_id:providerId})).data,1);
 }finally{if(first)await admin.auth.admin.deleteUser(first);if(second)await admin.auth.admin.deleteUser(second)}
});
