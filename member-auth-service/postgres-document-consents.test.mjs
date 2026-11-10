import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresMemberApp} from './app.mjs';

const docs=[{type:'terms',version:'t1',text:'Terms test'},{type:'privacy',version:'p1',text:'Privacy test'}];
const origin='https://site.example.test';
const accept=(d)=>({type:d.type,version:d.version,accepted:true});
test('separate consents are immutable, atomic, session bound and require both',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261109143636_member_auth_shared_rate_limit.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261109143737_member_auth_staging_privileges.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261110063351_member_document_consents.sql',import.meta.url),'utf8'));
  for (const d of docs) await db.query('INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ($1,$2,$3,$4)',[d.type,d.version,d.text,createHash('sha256').update(d.text).digest('hex')]);
  await db.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','t1'),('privacy','p1')");
  const pool={query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
  const auth={handler:async()=>new Response(null,{status:204}),api:{getSession:async({headers})=>headers.get('cookie')==='sid=one'?{user:{id:'one',emailVerified:true}}:headers.get('cookie')==='sid=two'?{user:{id:'two',emailVerified:true}}:null}};
  const app=await createPostgresMemberApp({auth,pool,documents:docs,allowedOrigins:[origin]});
  const req=(path,cookie='sid=one',body)=>new Request(origin+path,{method:body?'POST':'GET',headers:{origin,cookie,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.deepEqual((await (await app(req('/api/member/terms'))).json()).documents,docs);
  assert.equal((await app(req('/api/member/private'))).status,403);
  assert.equal((await app(req('/api/member/consent','sid=one',{consents:[accept(docs[0])]}))).status,200);
  assert.deepEqual((await (await app(req('/api/member/session'))).json()).consentStatus,{terms:true,privacy:false});
  assert.equal((await app(req('/api/member/private'))).status,403);
  assert.equal((await app(req('/api/member/consent','sid=one',{consents:[accept(docs[1]),{...accept(docs[1]),version:'wrong'}]}))).status,400);
  assert.deepEqual((await (await app(req('/api/member/session'))).json()).consentStatus,{terms:true,privacy:false});
  assert.equal((await app(req('/api/member/consent','sid=one',{consents:[accept(docs[1])]}))).status,200);
  assert.equal((await app(req('/api/member/private'))).status,200);
  assert.equal((await app(req('/api/member/private','sid=two'))).status,403);
  assert.equal((await app(req('/api/member/consent','bad',{consents:docs.map(accept)}))).status,401);
  await assert.rejects(createPostgresMemberApp({auth,pool,documents:[{...docs[0],text:'tampered'},docs[1]],allowedOrigins:[origin]}),/different text/);
  await db.query("INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ('privacy','p2',$1,$2)",[docs[1].text,createHash('sha256').update(docs[1].text).digest('hex')]);
  await db.exec("UPDATE member_auth_support.document_current SET version='p2' WHERE document_type='privacy'");
  assert.equal((await app(req('/api/member/session'))).status,503);
  const next=await createPostgresMemberApp({auth,pool,documents:[docs[0],{...docs[1],version:'p2'}],allowedOrigins:[origin]});
  assert.deepEqual((await (await next(req('/api/member/session'))).json()).consentStatus,{terms:true,privacy:false});
 } finally {await db.close()}
});
