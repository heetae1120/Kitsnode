import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createSharedRateLimit,withSharedRateLimit} from './shared-rate-limit.mjs';

test('global quota is shared across distinct IPs and account inputs',async()=>{
 const db=new PGlite();
 try {
  for(const file of ['20261109142215_kitsnode_member_auth_support.sql','20261109143636_member_auth_shared_rate_limit.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const gate=withSharedRateLimit(async()=>new Response('ok'),createSharedRateLimit({pool:db,max:2}));
  const request=(ip,email)=>new Request('https://auth.example.test/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({email,password:'fixture'})});
  assert.equal((await gate(request('192.0.2.1','a@example.test'))).status,200);
  assert.equal((await gate(request('192.0.2.1','a@example.test'))).status,200);
  assert.equal((await gate(request('192.0.2.2','b@example.test'))).status,429);
 } finally {await db.close()}
});

test('shared limit atomically caps requests and fails closed',async()=>{
 const pool=new PGlite();
 try {
  await pool.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await pool.exec(await readFile(new URL('../supabase/migrations/20261109143636_member_auth_shared_rate_limit.sql',import.meta.url),'utf8'));
  const a=createSharedRateLimit({pool,max:3}),b=createSharedRateLimit({pool,max:3});
  const results=await Promise.all([a(),b(),a(),b(),a(),b()]);assert.equal(results.filter(Boolean).length,3);
  const gate=withSharedRateLimit(async()=>new Response('ok'),a);
  assert.equal((await gate(new Request('https://auth.example.test/api/auth/sign-in/email',{method:'POST'}))).status,429);
  const unavailable=withSharedRateLimit(async()=>new Response('ok'),async()=>{throw new Error('private secret');});
  const response=await unavailable(new Request('https://auth.example.test/'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/secret/);
 } finally {await pool.close();}
});

test('rate limit errors allow only configured browser origins',async()=>{
 const trusted='https://site.example.test';
 for (const check of [async()=>false,async()=>{throw new Error('db down')}]) {
  const gate=withSharedRateLimit(async()=>new Response('ok'),check,[trusted]);
  const accepted=await gate(new Request('https://auth.example.test/api/member/session',{headers:{origin:trusted}}));
  assert.equal(accepted.headers.get('access-control-allow-origin'),trusted);
  assert.equal(accepted.headers.get('access-control-allow-credentials'),'true');
  assert.equal(accepted.headers.get('vary'),'Origin');
  const rejected=await gate(new Request('https://auth.example.test/api/member/session',{headers:{origin:'https://other.example.test'}}));
  assert.equal(rejected.headers.get('access-control-allow-origin'),null);
 }
});

test('staging support role can consume limit but cannot access ungranted tables',async()=>{
 const db=new PGlite();
 try {
  for (const file of ['20261109142215_kitsnode_member_auth_support.sql','20261109143636_member_auth_shared_rate_limit.sql','20261109143737_member_auth_staging_privileges.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec('CREATE TABLE member_auth_support.secret_fixture (id text); SET ROLE member_auth_runtime');
  assert.equal(await createSharedRateLimit({pool:db,max:1})(),true);
  await assert.rejects(db.query('SELECT * FROM member_auth_support.secret_fixture'));
 } finally {await db.close();}
});
