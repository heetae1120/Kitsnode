import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresMemberApp} from './app.mjs';

const frontend='http://127.0.0.1:4312';
const docs=[{type:'terms',version:'terms-v1',text:'Synthetic terms'}, {type:'privacy',version:'privacy-v1',text:'Synthetic privacy'}];
const selected=documents=>documents.map(({type,version})=>({type,version,accepted:true}));
const req=(path,options={})=>new Request(`http://127.0.0.1:4313${path}`, {method:options.method||'GET', headers:{origin:frontend,...(options.body?{'content-type':'application/json'}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});

test('production document handler returns separate anonymous state, rejects stale workers, and retains independent consent',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE SCHEMA member_auth_support;
    CREATE TABLE member_auth_support.document_versions(document_type text,version text,body text,digest text,PRIMARY KEY(document_type,version));
    CREATE TABLE member_auth_support.document_current(document_type text PRIMARY KEY,version text);
    CREATE TABLE member_auth_support.document_consents(user_id text,document_type text,version text,accepted_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,document_type,version));
    INSERT INTO member_auth_support.document_current VALUES ('terms','terms-v1'),('privacy','privacy-v1');`);
  const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
  let user=null, signupCalls=0;
  const auth={api:{getSession:async()=>user&&({user:{id:user,emailVerified:true}})},handler:async()=>{signupCalls++; return Response.json({ok:true});}};
  const create=documents=>createPostgresMemberApp({auth,pool,documents,allowedOrigins:[frontend],emailAvailable:true});
  const app=await create(docs);
  let response=await app(req('/api/member/session'));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).consentStatus,{terms:false,privacy:false},'anonymous state must satisfy current frontend contract');
  response=await app(req('/api/member/consent',{method:'POST',body:{consents:selected(docs)}}));
  assert.equal(response.status,401,'anonymous user cannot create records');
  user='synthetic-member';
  response=await app(req('/api/member/consent',{method:'POST',body:{consents:selected(docs)}}));
  assert.equal(response.status,200);
  response=await app(req('/api/member/session'));
  assert.deepEqual((await response.json()).consentStatus,{terms:true,privacy:true});
  await db.query("UPDATE member_auth_support.document_current SET version='privacy-v2' WHERE document_type='privacy'");
  response=await app(req('/api/member/terms'));
  assert.ok(!response.ok,'old worker must not publish superseded terms');
  response=await app(req('/api/auth/sign-up/email',{method:'POST',body:{email:'synthetic@example.test',password:'synthetic-password',consents:selected(docs)}}));
  assert.ok(!response.ok,'old worker must not create accounts under superseded documents');
  assert.equal(signupCalls,0,'superseded signup must not reach auth handler');
  const newer=[docs[0],{type:'privacy',version:'privacy-v2',text:'Updated synthetic privacy'}];
  const newApp=await create(newer);
  response=await newApp(req('/api/member/session'));
  assert.deepEqual((await response.json()).consentStatus,{terms:true,privacy:false});
  response=await newApp(req('/api/member/consent',{method:'POST',body:{consents:[{type:'privacy',version:'privacy-v2',accepted:true}]}}));
  assert.equal(response.status,200);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM member_auth_support.document_consents WHERE user_id=$1',['synthetic-member'])).rows[0].n,3);
 } finally {await db.close();}
});
