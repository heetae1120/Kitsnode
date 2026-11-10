import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {getMigrations} from 'better-auth/db/migration';
import {createMemberAuth,createNaverMemberAuth} from './auth.mjs';

// No email is sent: addresses and credentials are fixtures, and sendMail is injected.
for (const candidate of ['local', 'production']) test(`${candidate}: correct password retries unverified mail without exposing a session`,async()=>{
 const db=new DatabaseSync(':memory:');const mails=[];let failMail=true;
 const baseURL=candidate==='local'?'http://localhost:3000':'https://auth.example.test';
 const secret='synthetic-secret-do-not-use-in-production-1234567890';
 const sendMail=async item=>{mails.push(item);if(failMail)throw new Error('synthetic mail outage');};
 const common={database:db,baseURL,secret,trustedOrigins:[baseURL],sendMail};
 const makeAuth=()=>candidate==='local'?createMemberAuth(common):createNaverMemberAuth({...common,naver:{clientId:'fixture',clientSecret:'fixture'},claimState:async()=>true}).auth;
 const auth=makeAuth();
 // Independent instances avoid testing the built-in per-path limiter here.
 // The limiter itself remains enabled and is covered by separate tests.
 const post=async(path,body)=>{const instance=makeAuth(); (await instance.$context).rateLimit.enabled=false; return instance.handler(new Request(`${baseURL}/api/auth/${path}`,{method:'POST',headers:{origin:baseURL,'content-type':'application/json'},body:JSON.stringify(body)}));};
 const user={email:'person@example.test',password:'synthetic-password-123',name:'Fixture'};
 try {
  await(await getMigrations((await auth.$context).options)).runMigrations();
  const signup=await post('sign-up/email',user);
  assert.equal(signup.status,200);assert.equal(mails.length,1);
  assert.equal(db.prepare('SELECT "emailVerified" AS verified FROM "user"').get().verified,0);
  const wrong=await post('sign-in/email',{...user,password:'not-the-password'});
  const absent=await post('sign-in/email',{...user,email:'absent@example.test'});
  assert.equal(wrong.status,absent.status);assert.equal(mails.length,1,'invalid credentials must not send mail');
  const failedRetry=await post('sign-in/email',user);
  assert.equal(failedRetry.status,403);assert.equal(mails.length,2,'correct credentials trigger another attempt');
  assert.equal(failedRetry.headers.getSetCookie().some(c=>c.startsWith('better-auth.session_token=')),false);
  failMail=false;
  const retry=await post('sign-in/email',user);
  assert.equal(retry.status,403);assert.equal(mails.length,3);
  const verified=await auth.handler(new Request(mails.at(-1).url));
  assert.ok(verified.status>=200&&verified.status<400);
  const signin=await post('sign-in/email',user);
  assert.equal(signin.status,200);assert.equal(mails.length,3,'verified sign-in does not resend');
 } finally {db.close();}
});
