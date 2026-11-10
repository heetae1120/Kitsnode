import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabasePool} from './supabase-pool.mjs';
import {parseRuntimeConfig} from './runtime-config.mjs';
const ca='-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----';
test('pool is lazy, bounded and requires certificate verification',()=>{
 let config; class FakePool {constructor(value){config=value;}}
 createSupabasePool({connectionString:'postgresql://fixture:secret@db.example.test:6543/postgres',ca,Pool:FakePool});
 assert.equal(config.max,2);assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.ca,ca);
 assert.throws(()=>createSupabasePool({connectionString:'postgresql://fixture:secret@db.example.test/postgres?sslmode=disable',ca,Pool:FakePool}),/Invalid/);
 assert.throws(()=>createSupabasePool({connectionString:'postgresql://fixture:secret@db.example.test/postgres',ca:'',Pool:FakePool}),/Invalid/);
});
test('config rejects missing, insecure or unapproved redirects',()=>{
 const env={MEMBER_AUTH_ORIGIN:'https://auth.example.test',MEMBER_FRONTEND_ORIGINS:'https://site.example.test',MEMBER_CALLBACK_URLS:'https://site.example.test/store/login/',MEMBER_AUTH_SECRET:'a'.repeat(32),MEMBER_DATABASE_URL:'postgresql://a:b@db.example.test/postgres',MEMBER_DATABASE_CA:ca,MEMBER_TERMS_VERSION:'fixture',MEMBER_TERMS_TEXT:'synthetic',MEMBER_PRIVACY_VERSION:'fixture-privacy',MEMBER_PRIVACY_TEXT:'synthetic privacy',NAVER_CLIENT_ID:'fixture',NAVER_CLIENT_SECRET:'fixture',SENS_SERVICE_ID:'fixture',SENS_ACCESS_KEY:'fixture',SENS_SECRET_KEY:'fixture',SENS_FROM:'from@example.test'};
 assert.equal(parseRuntimeConfig(env).authOrigin,'https://auth.example.test');
 assert.throws(()=>parseRuntimeConfig({...env,MEMBER_CALLBACK_URLS:'https://evil.example.test/'}),/Invalid callback/);
 assert.throws(()=>parseRuntimeConfig({...env,MEMBER_AUTH_ORIGIN:'http://auth.example.test'}),/Invalid origin/);
 assert.throws(()=>parseRuntimeConfig({...env,NAVER_CLIENT_SECRET:''}),/Missing runtime setting/);
 const withoutMail={...env,MEMBER_EMAIL_ENABLED:'0',SENS_SERVICE_ID:'',SENS_ACCESS_KEY:'',SENS_SECRET_KEY:'',SENS_FROM:''};
 assert.equal(parseRuntimeConfig(withoutMail).emailAvailable,false);
 assert.equal(parseRuntimeConfig(withoutMail).sens,null);
 const {MEMBER_EMAIL_ENABLED:ignored,...defaultMail}=withoutMail;
 assert.equal(parseRuntimeConfig(defaultMail).emailAvailable,false);
 assert.equal(parseRuntimeConfig({...env,MEMBER_EMAIL_ENABLED:'1'}).emailAvailable,true);
 assert.throws(()=>parseRuntimeConfig({...withoutMail,MEMBER_EMAIL_ENABLED:'1'}),/Missing runtime setting/);
 assert.throws(()=>parseRuntimeConfig({...env,MEMBER_EMAIL_ENABLED:'false'}),/Invalid email setting/);
});

test('runtime wires a single pool into the portable handler and closes it on failure',async()=>{
 const {createCloudFunctionsRuntime}=await import('./cloud-functions-runtime.mjs');
 const env={MEMBER_AUTH_ORIGIN:'https://auth.example.test',MEMBER_FRONTEND_ORIGINS:'https://site.example.test',MEMBER_CALLBACK_URLS:'https://site.example.test/store/login/',MEMBER_AUTH_SECRET:'a'.repeat(32),MEMBER_DATABASE_URL:'postgresql://a:b@db.example.test/postgres',MEMBER_DATABASE_CA:ca,MEMBER_TERMS_VERSION:'fixture',MEMBER_TERMS_TEXT:'synthetic',MEMBER_PRIVACY_VERSION:'fixture-privacy',MEMBER_PRIVACY_TEXT:'synthetic privacy',NAVER_CLIENT_ID:'fixture',NAVER_CLIENT_SECRET:'fixture',SENS_SERVICE_ID:'fixture',SENS_ACCESS_KEY:'fixture',SENS_SECRET_KEY:'fixture',SENS_FROM:'from@example.test'};
 let closed=0;const pool={end:async()=>{closed++;}};
 const runtime=await createCloudFunctionsRuntime(env,{createPool:()=>pool,createRateLimit:()=>async()=>true,createHandler:async config=>{assert.equal(config.pool,pool);assert.equal(config.database,pool);return async()=>new Response('ok');}});
 const response=await runtime.action({__ow_method:'get',__ow_path:'/api/member/session',__ow_headers:{}});assert.equal(response.body,'ok');
 await runtime.close();assert.equal(closed,1);
 await assert.rejects(createCloudFunctionsRuntime(env,{createPool:()=>pool,createHandler:async()=>{throw new Error('failed');}}));assert.equal(closed,2);
});
