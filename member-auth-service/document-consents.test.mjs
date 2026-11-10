import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createDocumentConsentStore} from './document-consents.mjs';

test('separate immutable documents keep consent history and reject stale workers',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE SCHEMA member_auth_support;
   CREATE TABLE member_auth_support.document_versions(document_type text,version text,body text,digest text,PRIMARY KEY(document_type,version));
   CREATE TABLE member_auth_support.document_current(document_type text PRIMARY KEY,version text);
   CREATE TABLE member_auth_support.document_consents(user_id text,document_type text,version text,accepted_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,document_type,version));`);
  const pool={query:(...a)=>db.query(...a),connect:async()=>({query:(...a)=>db.query(...a),release(){}})};
  const docs=[{type:'terms',version:'v1',text:'synthetic terms'},{type:'privacy',version:'v1',text:'synthetic privacy'}];
  const store=createDocumentConsentStore(pool,docs);
  await assert.rejects(store.register(),/not current/);
  await db.query("INSERT INTO member_auth_support.document_current VALUES ('terms','v1'),('privacy','v1')");
  await store.register();
  assert.deepEqual(await store.status('u1'),{terms:false,privacy:false});
  await store.record('u1',docs.map(d=>({type:d.type,version:d.version,accepted:true})));
  assert.deepEqual(await store.status('u1'),{terms:true,privacy:true});
  assert.deepEqual(await store.status('u2'),{terms:false,privacy:false});
  await assert.rejects(createDocumentConsentStore(pool,[{...docs[0],text:'tampered'},docs[1]]).register(),/different text/);
  await db.query("UPDATE member_auth_support.document_current SET version='v2' WHERE document_type='privacy'");
  await assert.rejects(store.status('u1'),/not current/);
  await assert.rejects(store.record('u1',[{type:'privacy',version:'v1',accepted:true}]),/not current/);
  const next=createDocumentConsentStore(pool,[docs[0],{type:'privacy',version:'v2',text:'updated privacy'}]);
  await next.register();
  assert.deepEqual(await next.status('u1'),{terms:true,privacy:false});
  await next.record('u1',[{type:'privacy',version:'v2',accepted:true}]);
  assert.deepEqual(await next.status('u1'),{terms:true,privacy:true});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM member_auth_support.document_consents WHERE user_id=$1',['u1'])).rows[0].n,3);
 } finally {await db.close();}
});

test('document locks serialize within one store even when a callback fails', async()=>{
 const documents=[{type:'terms',version:'t1',text:'terms'},{type:'privacy',version:'p1',text:'privacy'}];
 let holders=0,peak=0;
 const pool={query:async()=>({rows:[]}),connect:async()=>({query:async(sql)=>{
  if(sql==='BEGIN'){holders++;peak=Math.max(peak,holders);}
  if(sql.includes('SELECT document_type,version'))return {rows:documents.map(({type,version})=>({document_type:type,version}))};
  if(sql==='COMMIT'||sql==='ROLLBACK')holders--;
  return {rows:[]};
 },release(){}})};
 const store=createDocumentConsentStore(pool,documents);
 let unblock;const pause=new Promise(resolve=>{unblock=resolve});
 const first=store.withCurrent(async()=>{await pause;throw new Error('expected');});
 const second=store.withCurrent(async()=>42);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(holders,1);unblock();
 await assert.rejects(first,/expected/);assert.equal(await second,42);assert.equal(peak,1);assert.equal(holders,0);
});
