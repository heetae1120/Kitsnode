import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { getMigrations } from 'better-auth/db/migration';
import { createMemberAuth } from './auth.mjs';
import { createMemberApp, provisionConsentSchema } from './app.mjs';

test('local HTTP authentication, consent, CORS and protected API', async () => {
 const db = new DatabaseSync(':memory:');
 const emails=[]; const origin='http://localhost:4312';
 const auth=createMemberAuth({database:db,baseURL:'http://localhost:3000',secret:'synthetic-secret-do-not-use-in-production-1234567890',trustedOrigins:[origin],sendMail:async mail=>emails.push(mail)});
 await (await getMigrations((await auth.$context).options)).runMigrations(); provisionConsentSchema(db);
 const terms={version:'fixture-1',text:'Synthetic terms, not for production.'};
 const app=createMemberApp({auth,database:db,terms,allowedOrigins:[origin]});
 assert.throws(()=>createMemberApp({auth,database:db,terms:{...terms,text:'changed'},allowedOrigins:[origin]}),/different text/);
 const server=createServer(toNodeHandler(app)); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  const get=(path,headers={})=>fetch(base+path,{headers:{origin,...headers},redirect:'manual'});
  const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body),redirect:'manual'});
  let r=await get('/api/member/terms'); assert.deepEqual(await r.json(),terms); assert.equal(r.headers.get('access-control-allow-origin'),origin); assert.equal(r.headers.get('access-control-allow-credentials'),'true');
  r=await get('/api/member/terms',{origin:'http://evil.test'}); assert.equal(r.status,403); assert.equal(r.headers.get('access-control-allow-origin'),null);
  r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); assert.equal(r.status,403);
  r=await get('/api/member/session'); assert.deepEqual(await r.json(),{authenticated:false,consented:false,memberAccess:false,naverAvailable:false,emailAvailable:true,emailVerified:false,emailVerificationAvailable:false});
  assert.equal((await post('/api/auth/sign-up/email/',{})).status,400);
  assert.equal((await post('/api/auth/sign-up/%65mail',{})).status,400);
  const user={name:'fixture',email:'sample@example.test',password:'synthetic-password-123'};
  assert.equal((await post('/api/auth/sign-up/email',user)).status,400);
  assert.equal((await post('/api/auth/sign-up/email',{...user,termsAccepted:true,termsVersion:'old'})).status,400);
  assert.equal((await post('/api/auth/sign-up/email',{...user,termsAccepted:true,termsVersion:'fixture-1'})).status,200); assert.equal((await post('/api/auth/sign-in/email',user)).status,403);
  assert.equal(emails.length,2); r=await app(new Request(emails[0].url)); assert.ok(r.status>=200&&r.status<400);
  r=await post('/api/auth/sign-in/email',user); assert.equal(r.status,200); const cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '); assert.ok(cookie);
  r=await get('/api/member/session',{cookie}); assert.deepEqual(await r.json(),{authenticated:true,consented:false,memberAccess:true,naverAvailable:false,emailAvailable:true,emailVerified:true,emailVerificationAvailable:false});
  assert.equal((await get('/api/member/private',{cookie})).status,403);
  assert.equal((await post('/api/member/consent',{accepted:true,version:'fixture-1'},{cookie})).status,200);
  assert.equal((await get('/api/member/private',{cookie})).status,200);
  assert.deepEqual(await (await get('/api/member/session',{cookie})).json(),{authenticated:true,consented:true,memberAccess:true,naverAvailable:false,emailAvailable:true,emailVerified:true,emailVerificationAvailable:false});
  assert.equal((await post('/api/member/consent',{accepted:true,version:'fixture-1',userId:'other'},{cookie})).status,400);
  assert.equal((await get('/api/member/private',{cookie:'better-auth.session_token=forged'})).status,401);
 } finally { await new Promise(resolve=>server.close(resolve)); db.close(); }
});

test('disabled or malformed configuration fails closed',()=>{
 assert.throws(()=>createMemberApp({terms:{version:'',text:''}}),/incomplete/);
 assert.throws(()=>createMemberAuth({database:{},baseURL:'http://localhost',secret:'fixture',trustedOrigins:[],sendMail:async()=>{},naver:{clientId:'fixture',clientSecret:'fixture'}}),/Naver provider disabled/);
});
