import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {getMigrations} from 'better-auth/db/migration';
import {createNaverMemberAuth} from './auth.mjs';
import {createProductionMemberHandler} from './production-runtime.mjs';
import {createCloudFunctionsAdapter} from './cloud-functions-adapter.mjs';

test('candidate composes auth, consent, SENS and Cloud Functions with isolated databases',async()=>{
 const db=new DatabaseSync(':memory:'); const pool=new PGlite(); const mails=[];
 const transactionalPool={query:(...args)=>pool.query(...args),connect:async()=>({query:(...args)=>pool.query(...args),release(){}})};
 const authOrigin='https://auth.example.test', frontendOrigin='https://site.example.test';
 const documents=[{type:'terms',version:'synthetic-t1',text:'Synthetic terms'},{type:'privacy',version:'synthetic-p1',text:'Synthetic privacy'}];
 const naver={clientId:'synthetic-id',clientSecret:'synthetic-secret'};
 const secret='synthetic-secret-never-use-in-production-123456789';
 const fetchImpl=async (url,options)=>{assert.match(String(url),/^https:\/\/sens\.apigw\.ntruss\.com\//);mails.push(JSON.parse(options.body));return Response.json({requestId:'synthetic-request',requestCount:1},{status:202});};
 try {
  await pool.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await pool.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await pool.exec(await readFile(new URL('../supabase/migrations/20261109143636_member_auth_shared_rate_limit.sql',import.meta.url),'utf8'));
  await pool.exec(await readFile(new URL('../supabase/migrations/20261109143737_member_auth_staging_privileges.sql',import.meta.url),'utf8'));
  await pool.exec(await readFile(new URL('../supabase/migrations/20261110063351_member_document_consents.sql',import.meta.url),'utf8'));
  for(const d of documents) await pool.query('INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ($1,$2,$3,$4)',[d.type,d.version,d.text,createHash('sha256').update(d.text).digest('hex')]);
  await pool.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','synthetic-t1'),('privacy','synthetic-p1')");
  const seed=createNaverMemberAuth({database:db,baseURL:authOrigin,secret,trustedOrigins:[frontendOrigin],sendMail:async()=>{},naver,claimState:async()=>true,fetchImpl});
  await (await getMigrations((await seed.auth.$context).options)).runMigrations();
  const handler=await createProductionMemberHandler({database:db,pool:transactionalPool,authOrigin,secret,frontendOrigins:[frontendOrigin],callbackURLs:[frontendOrigin+'/store/login/'],documents,naver,sens:{serviceId:'synthetic-service',accessKey:'synthetic-key',secretKey:'synthetic-secret',from:'no-reply@example.test'},fetchImpl});
  const action=createCloudFunctionsAdapter({origin:authOrigin,handle:handler});
  const event={__ow_method:'post',__ow_path:'/api/auth/sign-up/email',__ow_query:'',__ow_headers:{origin:frontendOrigin,'content-type':'application/json'},__ow_body:Buffer.from(JSON.stringify({email:'user@example.test',password:'synthetic-password-123',name:'Fixture',consents:documents.map(({type,version})=>({type,version,accepted:true}))})).toString('base64')};
  const result=await action(event); assert.equal(result.statusCode,200, result.body); assert.equal(mails.length,1); assert.equal(mails[0].recipients[0].address,'user@example.test');
  const session=await action({__ow_method:'get',__ow_path:'/api/member/session',__ow_headers:{origin:frontendOrigin}}); assert.equal(JSON.parse(session.body).authenticated,false);
  const naverOnly=await createProductionMemberHandler({database:db,pool:transactionalPool,authOrigin,secret,frontendOrigins:[frontendOrigin],callbackURLs:[frontendOrigin+'/store/login/'],documents,naver,emailAvailable:false,fetchImpl});
  const disabled=await naverOnly(new Request(authOrigin+'/api/auth/sign-up/email',{method:'POST',headers:{origin:frontendOrigin,'content-type':'application/json'},body:'{}'}));
  assert.equal(disabled.status,404); assert.equal(mails.length,1);
  const state=await naverOnly(new Request(authOrigin+'/api/member/session',{headers:{origin:frontendOrigin}}));
  assert.equal((await state.json()).emailAvailable,false);
 } finally {db.close();await pool.close();}
});
