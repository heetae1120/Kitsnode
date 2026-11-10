import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCloudflareWorker} from './cloudflare-worker.mjs';
const env={HYPERDRIVE:{connectionString:'postgresql://fixture@hyperdrive.internal/test'},MEMBER_HYPERDRIVE_SCHEMA_VERIFIED:'1',MEMBER_AUTH_ORIGIN:'https://auth.example.test',MEMBER_FRONTEND_ORIGINS:'https://site.example.test',MEMBER_CALLBACK_URLS:'https://site.example.test/member',MEMBER_AUTH_SECRET:'fixture-secret-for-testing-1234567890',MEMBER_TERMS_VERSION:'test-v1',MEMBER_TERMS_TEXT:'Synthetic terms',NAVER_CLIENT_ID:'fixture',NAVER_CLIENT_SECRET:'fixture',MEMBER_EMAIL_ENABLED:'0',MEMBER_EDGE_LIMITS_ENABLED:'1',MEMBER_RATE_LIMIT_SECRET:'x'.repeat(32),MEMBER_SITE_LIMIT:{limit:async()=>({success:true})},MEMBER_IP_LIMIT:{limit:async()=>({success:true})},MEMBER_ACCOUNT_LIMIT:{limit:async()=>({success:true})}};
env.MEMBER_PRIVACY_VERSION='privacy-v1';
env.MEMBER_PRIVACY_TEXT='Synthetic privacy';
env.MEMBER_PRIVACY_SHA256=createHash('sha256').update(env.MEMBER_PRIVACY_TEXT).digest('hex');
env.MEMBER_TERMS_SHA256=createHash('sha256').update(env.MEMBER_TERMS_TEXT).digest('hex');
const bundle={terms:{version:env.MEMBER_TERMS_VERSION,text:env.MEMBER_TERMS_TEXT},privacy:{version:env.MEMBER_PRIVACY_VERSION,text:env.MEMBER_PRIVACY_TEXT}};
const worker=deps=>createCloudflareWorker({...deps,termsBundle:bundle});
test('edge IP limit gates before DB and passes account limiter only when enabled',async()=>{
 let opened=0, passed;
 const limiter={limit:async()=>({success:true})};
 const scoped={...env,MEMBER_EDGE_LIMITS_ENABLED:'1',MEMBER_IP_LIMIT:limiter,MEMBER_ACCOUNT_LIMIT:limiter,MEMBER_RATE_LIMIT_SECRET:'k'.repeat(32)};
 const w=worker({createPool:()=>{opened++;return {end:async()=>{}}},createHandler:async cfg=>{passed=cfg.accountLimit;return async()=>new Response('ok')},createRateLimit:()=>async()=>true});
 const req=()=>new Request('https://auth.example.test/api/member/session',{headers:{'cf-connecting-ip':'192.0.2.1'}});
 assert.equal((await w.fetch(req(),{...scoped,MEMBER_IP_LIMIT:{limit:async()=>({success:false})}})).status,429);assert.equal(opened,0);
 assert.equal((await w.fetch(req(),scoped)).status,200);assert.equal(typeof passed,'function');assert.equal(await passed('fixture-user'),true);
 assert.equal((await w.fetch(new Request('https://auth.example.test/api/member/session'),scoped)).status,503);
});
test('per-request pool preserves cookies and closes',async()=>{
 const pools=[];let seen;
 const w=worker({createPool:cs=>{assert.equal(cs,env.HYPERDRIVE.connectionString);const p={end:async()=>{p.closed=true}};pools.push(p);return p},createHandler:async config=>{seen=config;return async()=>{const h=new Headers();h.append('set-cookie','a=1; Path=/; Secure');h.append('set-cookie','b=2; Path=/; Secure');return new Response('ok',{headers:h})}},createRateLimit:()=>async()=>true});
 for(let i=0;i<2;i++){const res=await w.fetch(new Request('https://auth.example.test/test',{headers:{'cf-connecting-ip':'192.0.2.1'}}),env);assert.equal(res.status,200);assert.equal(res.headers.getSetCookie().length,2)}
 assert.equal(pools.length,2);assert.notEqual(pools[0],pools[1]);assert.ok(pools.every(p=>p.closed));assert.equal(seen.database,seen.pool);
});
test('fails closed on missing schema attestation, wrong origin and init failure',async()=>{
 let count=0;const pool={end:async()=>{count++}};const w=worker({createPool:()=>pool,createHandler:async()=>{throw new Error('private fixture')},createRateLimit:()=>async()=>true});
 assert.equal((await w.fetch(new Request('https://auth.example.test/'),{...env,MEMBER_HYPERDRIVE_SCHEMA_VERIFIED:'0'})).status,503);
 assert.equal((await w.fetch(new Request('https://other.example.test/'),env)).status,404);
 const res=await w.fetch(new Request('https://auth.example.test/',{headers:{'cf-connecting-ip':'192.0.2.1'}}),env);assert.equal(res.status,503);assert.deepEqual(await res.json(),{error:'unavailable'});assert.equal(count,1);
});
test('invalid terms fail before DB access',async()=>{
 let opened=false;
 const w=worker({createPool:()=>{opened=true;throw new Error('unexpected')}});
 const res=await w.fetch(new Request('https://auth.example.test/api/member/session',{headers:{'cf-connecting-ip':'192.0.2.1'}}),{...env,MEMBER_TERMS_SHA256:'0'.repeat(64)});
 assert.equal(res.status,503);assert.equal(opened,false);
});

test('stalled pool close does not block the response',async()=>{
 const w=worker({closeTimeoutMs:5,createPool:()=>({end:()=>new Promise(()=>{})}),createHandler:async()=>async()=>new Response('ok'),createRateLimit:()=>async()=>true});
 const res=await w.fetch(new Request('https://auth.example.test/',{headers:{'cf-connecting-ip':'192.0.2.1'}}),env);assert.equal(res.status,200);
});

test('preflight validates origin without opening DB',async()=>{
 let opened=false;const w=worker({createPool:()=>{opened=true;throw new Error('unexpected')}});
 const preflight=origin=>new Request('https://auth.example.test/api/auth/sign-in/social',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}});
 const ok=await w.fetch(preflight('https://site.example.test'),env);assert.equal(ok.status,204);assert.equal(ok.headers.get('access-control-allow-origin'),'https://site.example.test');
 assert.equal((await w.fetch(preflight('https://evil.example.test'),env)).status,403);assert.equal(opened,false);
});

test('an exhausted IP cannot consume another IP quota',async()=>{
 const counts=new Map();
 const limiter={limit:async ({key})=>{const n=(counts.get(key)||0)+1;counts.set(key,n);return {success:n<=1}}};
 const w=worker({createPool:()=>({end:async()=>{}}),createHandler:async()=>async()=>new Response('ok')});
 const request=ip=>new Request('https://auth.example.test/api/member/session',{headers:{'cf-connecting-ip':ip}});
 const settings={...env,MEMBER_IP_LIMIT:limiter};
 assert.equal((await w.fetch(request('192.0.2.1'),settings)).status,200);
 assert.equal((await w.fetch(request('192.0.2.1'),settings)).status,429);
 assert.equal((await w.fetch(request('192.0.2.2'),settings)).status,200);
});

test('site circuit breaker rejects distributed requests before opening database',async()=>{
 let opened=0;const counts=new Map();
 const limiter={limit:async ({key})=>{const n=(counts.get(key)||0)+1;counts.set(key,n);return {success:n<=2}}};
 const w=worker({createPool:()=>{opened++;return {end:async()=>{}}},createHandler:async()=>async()=>new Response('ok')});
 const settings={...env,MEMBER_SITE_LIMIT:limiter};
 for(const [ip,status] of [['192.0.2.1',200],['192.0.2.2',200],['192.0.2.3',429]]) {
  assert.equal((await w.fetch(new Request('https://auth.example.test/api/member/session',{headers:{'cf-connecting-ip':ip}}),settings)).status,status);
 }
 assert.equal(opened,2);
 assert.equal((await w.fetch(new Request('https://auth.example.test/api/member/session',{headers:{'cf-connecting-ip':'192.0.2.4'}}),{...env,MEMBER_SITE_LIMIT:undefined})).status,503);
});
