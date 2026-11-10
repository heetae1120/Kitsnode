import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {getMigrations} from 'better-auth/db/migration';
import {createNaverMemberAuth} from './auth.mjs';
import {createProductionMemberHandler} from './production-runtime.mjs';

test('mock Naver member can access basic API while mailbox remains independently unverified',async()=>{
 const authOrigin='https://auth.example.test',frontend='https://front.example.test';
 const secret='synthetic-secret-never-use-in-production-123456789';
 const naver={clientId:'synthetic-client',clientSecret:'synthetic-secret'};
 const documents=[{type:'terms',version:'terms-v1',text:'synthetic terms'},{type:'privacy',version:'privacy-v1',text:'synthetic privacy'}];
 const db=new DatabaseSync(':memory:'),pg=new PGlite();
 const pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 let emailBody,mailCount=0,naverCalls=0;
 const fetchImpl=async(input,init)=>{
  if(input==='https://nid.naver.com/oauth2.0/token'){naverCalls++;return Response.json({access_token:'fixture-token',token_type:'Bearer'});}
  if(input==='https://openapi.naver.com/v1/nid/me'){naverCalls++;return Response.json({resultcode:'00',response:{id:'fixture-id',email:'person@example.test',nickname:'Fixture'}});}
  if(String(input).startsWith('https://sens.apigw.ntruss.com/')){mailCount++;emailBody=JSON.parse(init.body);return Response.json({requestId:'fixture-receipt',requestCount:1},{status:202});}
  throw new Error('Unexpected network request');
 };
 const post=(path,body,cookie)=>new Request(authOrigin+path,{method:'POST',headers:{origin:frontend,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 const get=(path,cookie)=>new Request(authOrigin+path,{headers:{origin:frontend,...(cookie?{cookie}:{})}});
 try{
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109143636_member_auth_shared_rate_limit.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109143737_member_auth_staging_privileges.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../supabase/migrations/20261110063351_member_document_consents.sql',import.meta.url),'utf8'));
  for(const d of documents)await pg.query('INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ($1,$2,$3,$4)',[d.type,d.version,d.text,createHash('sha256').update(d.text).digest('hex')]);
  await pg.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','terms-v1'),('privacy','privacy-v1')");
  const seed=createNaverMemberAuth({database:db,baseURL:authOrigin,secret,trustedOrigins:[frontend],sendMail:async()=>{},naver,claimState:async()=>true,fetchImpl});
  await(await getMigrations((await seed.auth.$context).options)).runMigrations();
  const app=await createProductionMemberHandler({database:db,pool,authOrigin,secret,frontendOrigins:[frontend],callbackURLs:[frontend+'/store/login/'],documents,naver,sens:{serviceId:'fixture',accessKey:'fixture',secretKey:'fixture',from:'sender@example.test'},accountLimit:async()=>true,naverIdentityLookup:async userId => !!db.prepare("SELECT 1 FROM account a WHERE a.userId=? AND a.providerId='naver' AND length(a.accountId)>0 AND NOT EXISTS (SELECT 1 FROM account b WHERE b.userId=? AND b.providerId<>'naver') LIMIT 1").get(userId,userId),fetchImpl});
  const start=await app(post('/api/auth/sign-in/social',{provider:'naver',callbackURL:frontend+'/store/login/'}));
  assert.equal(start.status,200);const state=new URL((await start.json()).url).searchParams.get('state');
  const stateCookie=start.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  const callback=await app(new Request(`${authOrigin}/api/auth/callback/naver?code=fixture&state=${encodeURIComponent(state)}`,{headers:{cookie:stateCookie}}));
  assert.equal(callback.status,302);const sessionCookie=callback.headers.getSetCookie().filter(c=>/session_token=/.test(c)).map(c=>c.split(';')[0]).join('; ');
  assert.ok(sessionCookie.includes('session_token='));assert.equal(naverCalls,2);
  let session=await (await app(get('/api/member/session',sessionCookie))).json();
  assert.equal(session.authenticated,true);assert.equal(session.emailVerified,false);
  const consents=documents.map(({type,version})=>({type,version,accepted:true}));
  const consent=await app(post('/api/member/consent',{consents},sessionCookie));assert.equal(consent.status,200);
  assert.equal((await app(get('/api/member/private',sessionCookie))).status,200);
  const priorMailCount=mailCount;
  const verify=await app(post('/api/member/verify-email',{},sessionCookie));assert.equal(verify.status,200);
  assert.equal(mailCount,priorMailCount+1);assert.equal(emailBody.recipients[0].address,'person@example.test');
  const match=emailBody.body.match(/href="([^"]+)"/);assert.ok(match);const link=match[1].replaceAll('&amp;','&');
  const verifyResult=await app(new Request(link,{headers:{cookie:sessionCookie}}));
  assert.ok(verifyResult.status>=200&&verifyResult.status<400,`verification status ${verifyResult.status}`);
  session=await (await app(get('/api/member/session',sessionCookie))).json();
  assert.equal(session.emailVerified,true);assert.equal(session.consented,true);
  assert.equal((await app(get('/api/member/private',sessionCookie))).status,200);
  assert.equal(db.prepare('SELECT accessToken FROM account').get().accessToken,null);
 } finally {db.close();await pg.close();}
});
