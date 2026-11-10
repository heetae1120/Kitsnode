import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createIsolatedNaverServer,testDocuments} from './isolated-naver-server.mjs';

test('isolated test flow stores both consent records and uses a local test mailbox',async()=>{
 const pg=new PGlite(); let db;
 const role={role:'kitsnode_auth_test_runtime',test_schema:true,auth_schema:false,support_schema:false,insert_consent:true,update_current:false};
 const pool={query:(q,...a)=>q.includes('current_user AS role')?Promise.resolve({rows:[role]}):pg.query(q,...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 const provider=async input=>input==='https://nid.naver.com/oauth2.0/token'?Response.json({access_token:'fake',token_type:'Bearer'}):input==='https://openapi.naver.com/v1/nid/me'?Response.json({resultcode:'00',response:{id:'synthetic',email:'test@example.test',nickname:'test'}}):Promise.reject(new Error('Unexpected network'));
 const origin='http://127.0.0.1:4323';
 const post=(path,body,cookie)=>new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 const get=(path,cookie,extra={})=>new Request(origin+path,{headers:{origin,...(cookie?{cookie}:{}),...extra}});
 try{
  const migration=await readFile(new URL('../supabase/migrations/20261110063351_member_document_consents.sql',import.meta.url),'utf8');
  const tables=migration.slice(migration.indexOf('CREATE TABLE'),migration.indexOf('ALTER TABLE')).replaceAll('member_auth_support.','kitsnode_auth_test.');
  await pg.exec('CREATE SCHEMA kitsnode_auth_test;'+tables);
  for(const d of testDocuments){await pg.query('INSERT INTO kitsnode_auth_test.document_versions(document_type,version,body,digest) VALUES ($1,$2,$3,$4)',[d.type,d.version,d.text,createHash('sha256').update(d.text).digest('hex')]);await pg.query('INSERT INTO kitsnode_auth_test.document_current(document_type,version) VALUES ($1,$2)',[d.type,d.version]);}
  const server=await createIsolatedNaverServer({pool,clientId:'fixture',clientSecret:'fixture',fetchImpl:provider,testRecipient:'recipient@example.test'});db=server.db;
  const preflight=await server.handler(new Request(origin+'/api/auth/sign-up/email',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
  assert.equal(preflight.status,204);
  assert.equal((await server.handler(post('/api/auth/sign-up/email',{email:'other@example.test'}))).status,403);
  const start=await server.handler(post('/api/auth/sign-in/social',{provider:'naver',callbackURL:origin+'/test/'}));assert.equal(start.status,200);
  const state=new URL((await start.json()).url).searchParams.get('state');
  const stateCookie=start.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const callback=await server.handler(get('/api/auth/callback/naver?code=fake&state='+encodeURIComponent(state),stateCookie));assert.equal(callback.status,302);
  const cookie=callback.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const selections=testDocuments.map(({type,version})=>({type,version,accepted:true}));
  assert.equal((await server.handler(post('/api/member/consent',{consents:selections},cookie))).status,200);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM kitsnode_auth_test.document_consents')).rows[0].n,2);
  assert.equal((await server.handler(get('/api/member/private',cookie))).status,200);
  assert.equal((await server.handler(post('/api/member/verify-email',{},cookie))).status,200);
  assert.equal((await server.handler(get('/__test/mail',cookie))).status,403);
  const mail=await server.handler(get('/__test/mail',cookie,{'sec-fetch-site':'same-origin'}));assert.equal(mail.status,200);
  const verify=await server.handler(new Request((await mail.json()).url,{headers:{cookie}}));assert.ok(verify.status>=200&&verify.status<400);
  const session=await (await server.handler(get('/api/member/session',cookie))).json();assert.equal(session.consented,true);assert.equal(session.emailVerified,true);
  assert.equal((await server.handler(get('/api/member/private',cookie))).status,200);
  assert.equal(db.prepare('SELECT accessToken FROM account').get().accessToken,null);
  const signup=await server.handler(post('/api/auth/sign-up/email',{email:'recipient@example.test',password:'synthetic-password-123',name:'',consents:selections,callbackURL:origin+'/test/'}));
  assert.equal(signup.status,200);
 }finally{db?.close();await pg.close();}
});
