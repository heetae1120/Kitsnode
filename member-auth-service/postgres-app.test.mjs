import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresMemberApp } from './app.mjs';

test('account limiting uses verified session identities and keeps accounts independent',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await db.exec('CREATE SCHEMA member_auth; CREATE TABLE member_auth.account ("userId" text, "providerId" text, "accountId" text)');
  const counts=new Map();
  const auth={handler:async()=>new Response(null,{status:204}),api:{getSession:async({headers})=>headers.get('cookie')==='session=valid-a'?{user:{id:'verified-a'}}:headers.get('cookie')==='session=valid-b'?{user:{id:'verified-b'}}:null}};
  const app=await createPostgresMemberApp({auth,pool:db,terms:{version:'fixture',text:'fixture'},allowedOrigins:['https://site.example'],accountLimit:async id=>{const n=(counts.get(id)||0)+1;counts.set(id,n);return n<=1}});
  const req=cookie=>new Request('https://site.example/api/member/session',{headers:{cookie,'x-user-id':'attacker-chosen'}});
  assert.equal((await app(req('session=valid-a'))).status,200);
  assert.equal((await app(req('session=valid-a'))).status,429);
  assert.equal((await app(req('session=valid-b'))).status,200);
  assert.equal((await app(req('session=forged'))).status,200);
  assert.deepEqual([...counts.keys()],['verified-a','verified-b']);
 } finally {await db.close()}
});

test('Postgres app enforces immutable consent and verified session on private access', async () => {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await db.exec('CREATE SCHEMA member_auth; CREATE TABLE member_auth.account ("userId" text, "providerId" text, "accountId" text)');
  const origin='https://frontend.example.test';
  const auth={handler:async()=>new Response(null,{status:204}),api:{getSession:async({headers}) => {
    const cookie=headers.get('cookie');
    if(cookie==='session=verified') return {user:{id:'fixture-a',emailVerified:true}};
    if(cookie==='session=unverified') return {user:{id:'fixture-b',emailVerified:false}};
    if(cookie==='session=other') return {user:{id:'fixture-c',emailVerified:true}};
    return null;
  }}};
  const terms={version:'fixture-v1',text:'Synthetic terms only'};
  try {
    const app=await createPostgresMemberApp({auth,pool:db,terms,allowedOrigins:[origin]});
    const request=(path,cookie,method='GET',body) => new Request('https://auth.example.test'+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    assert.equal((await app(request('/api/auth/reset-password/fixture-token',null))).status,404);
    assert.equal((await app(request('/api/auth/verify-email',null))).status,404);
    assert.equal((await app(request('/api/member/private','session=verified'))).status,403);
    assert.equal((await app(request('/api/member/consent','session=verified','POST',{accepted:true,version:terms.version}))).status,200);
    assert.equal((await app(request('/api/member/private','session=verified'))).status,200);
    assert.equal((await app(request('/api/member/private','session=other'))).status,403);
    assert.equal((await app(request('/api/member/consent','session=unverified','POST',{accepted:true,version:terms.version}))).status,200);
    assert.equal((await app(request('/api/member/private','session=unverified'))).status,403);
    await db.query('INSERT INTO member_auth.account ("userId","providerId","accountId") VALUES ($1,$2,$3)', ['fixture-b','naver','naver-subject']);
    let naverSession=await (await app(request('/api/member/session','session=unverified'))).json();
    assert.equal(naverSession.memberAccess,true);assert.equal(naverSession.emailVerified,false);
    assert.equal((await app(request('/api/member/private','session=unverified'))).status,200);
    assert.equal((await app(request('/api/member/private','session=other'))).status,403);
    await db.query('INSERT INTO member_auth.account ("userId","providerId","accountId") VALUES ($1,$2,$3)', ['fixture-b','credential','other-account']);
    assert.equal((await app(request('/api/member/private','session=unverified'))).status,403);
    assert.equal((await app(request('/api/member/consent',null,'POST',{accepted:true,version:terms.version}))).status,401);
    await assert.rejects(createPostgresMemberApp({auth,pool:db,terms:{...terms,text:'Changed'},allowedOrigins:[origin]}),/different text/);
  } finally { await db.close(); }
});

test('Postgres app cannot start without required schema or terms', async () => {
  const db=new PGlite();
  try {
    const auth={handler:async()=>new Response(),api:{}};
    await assert.rejects(createPostgresMemberApp({auth,pool:db,terms:{version:'v1',text:'fixture'},allowedOrigins:['https://frontend.example.test']}));
    await assert.rejects(createPostgresMemberApp({auth,pool:db,terms:{version:'',text:''},allowedOrigins:['https://frontend.example.test']}),/incomplete/);
  } finally { await db.close(); }
});
