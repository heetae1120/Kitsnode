import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPostgresMemberApp} from './app.mjs';
import {createSensMailSender} from './mail.mjs';

const docs=[{type:'terms',version:'t1',text:'synthetic terms'},{type:'privacy',version:'p1',text:'synthetic privacy'}];
const origin='https://front.example.test';
const url='https://auth.example.test';
const consents=docs.map(({type,version})=>({type,version,accepted:true}));
const req=(path,body)=>new Request(url+path,{method:body?'POST':'GET',headers:{origin,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});

// No network or customer data: the fetch substitute honours the real abort
// signal and never contacts SENS. SQL is simulated, not a PostgreSQL lock test.
test('stalled SENS request is aborted and releases the consent lock queue', {timeout:16000}, async()=>{
 const stored=new Map(); let holders=0,peak=0,rollbacks=0,commits=0,enteredFetch;
 const started=new Promise(resolve=>{enteredFetch=resolve});
 const current=()=>({rows:docs.map(({type,version})=>({document_type:type,version}))});
 const query=async(sql,args=[])=>{
  if(sql.startsWith('INSERT INTO member_auth_support.document_versions')) {stored.set(args[0]+args[1],{body:args[2],digest:args[3]});return {rows:[]};}
  if(sql.includes('pg_try_advisory_xact_lock')) return {rows:[{acquired:true}]};
  if(sql.startsWith('SELECT body,digest')) return {rows:[stored.get(args[0]+args[1])]};
  if(sql.startsWith('SELECT document_type,version FROM member_auth_support.document_current'))return current();
  if(sql==='BEGIN'){holders++;peak=Math.max(holders,peak);}
  if(sql==='ROLLBACK'){holders--;rollbacks++;}
  if(sql==='COMMIT'){holders--;commits++;}
  return {rows:[]};
 };
 const pool={query,connect:async()=>({query,release(){}})};
 let signals=0;
 const send=createSensMailSender({serviceId:'fixture',accessKey:'fixture',secretKey:'fixture',from:'sender@example.test',authBaseURL:url,redirectOrigins:[origin],fetchImpl:async(_url,{signal})=>{
  signals++; enteredFetch();
  return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 }});
 const auth={api:{getSession:async()=>null},handler:async()=>{await send({to:'person@example.test',kind:'verification',url:url+'/api/auth/verify-email?token=fixture'});return Response.json({ok:true});}};
 const app=await createPostgresMemberApp({auth,pool,documents:docs,allowedOrigins:[origin],emailAvailable:true});
 const signup=app(req('/api/auth/sign-up/email',{email:'person@example.test',password:'fixture-password',consents}));
 await started;
 let termsFinished=false;
 const terms=app(req('/api/member/terms')).then(r=>{termsFinished=true;return r;});
 await new Promise(resolve=>setTimeout(resolve,75));
 assert.equal(termsFinished,false,'terms waits while signup holds the shared lock');
 assert.equal(holders,1);assert.equal(peak,1);
 const result=await signup;
 assert.equal(result.status,503);assert.equal((await terms).status,200);
 assert.equal(signals,1);assert.equal(holders,0);assert.equal(rollbacks,1);assert.equal(commits,1);
});

test('real auth signup on mail timeout reports whether a synthetic account survives', {timeout:20000}, async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const {PGlite}=await import('@electric-sql/pglite');
 const {getMigrations}=await import('better-auth/db/migration');
 const {createNaverMemberAuth}=await import('./auth.mjs');
 const {createProductionMemberHandler}=await import('./production-runtime.mjs');
 const {readFile}=await import('node:fs/promises');
 const db=new DatabaseSync(':memory:');const pg=new PGlite();
 const pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 const secret='synthetic-secret-never-use-in-production-123456789';
 const naver={clientId:'synthetic-id',clientSecret:'synthetic-secret'};
 let started;const mailStarted=new Promise(resolve=>{started=resolve});
 const fetchImpl=async(_input,{signal})=>{started();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));};
 try{
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109143636_member_auth_shared_rate_limit.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../supabase/migrations/20261109143737_member_auth_staging_privileges.sql',import.meta.url),'utf8'));
  await pg.exec(await readFile(new URL('../supabase/migrations/20261110063351_member_document_consents.sql',import.meta.url),'utf8'));
  for(const d of docs)await pg.query('INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ($1,$2,$3,$4)',[d.type,d.version,d.text,createHash('sha256').update(d.text).digest('hex')]);
  await pg.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','t1'),('privacy','p1')");
  const seed=createNaverMemberAuth({database:db,baseURL:url,secret,trustedOrigins:[origin],sendMail:async()=>{},naver,claimState:async()=>true,fetchImpl});
  await(await getMigrations((await seed.auth.$context).options)).runMigrations();
  const app=await createProductionMemberHandler({database:db,pool,authOrigin:url,secret,frontendOrigins:[origin],callbackURLs:[origin+'/store/login/'],documents:docs,naver,sens:{serviceId:'fixture',accessKey:'fixture',secretKey:'fixture',from:'sender@example.test'},fetchImpl});
  const signup=app(req('/api/auth/sign-up/email',{email:'person@example.test',name:'Fixture',password:'synthetic-password-123',consents}));
  await mailStarted;
  assert.equal(db.prepare('SELECT count(*) n FROM user').get().n,1,'auth creates the account before the mail response');
  const result=await signup;
  assert.equal(result.status,200,'Better Auth swallows the mail failure and reports signup success');
  assert.equal(db.prepare('SELECT count(*) n FROM user').get().n,1,'failed mail does not roll back the account in a separate database');
  assert.equal(db.prepare('SELECT emailVerified FROM user').get().emailVerified,0);
 } finally{db.close();await pg.close();}
});

test('without signup admission independent stores can exhaust a shared upstream limit', {timeout:2000}, async()=>{
 const {createDocumentConsentStore}=await import('./document-consents.mjs');
 const limit=2;let active=0,peak=0;const waiting=[];
 let queueReady;const bothWaiting=new Promise(resolve=>{queueReady=resolve});
 function client(){
  let released=false;
  return {query:async(sql)=>sql.startsWith('SELECT document_type,version FROM member_auth_support.document_current')
   ? {rows:docs.map(({type,version})=>({document_type:type,version}))} : {rows:[]},
   release(){if(released)throw new Error('double release');released=true;active--;}};
 }
 const shared={query:async()=>({rows:[]}),connect:async()=>{
  if(active<limit){active++;peak=Math.max(peak,active);return client();}
  return new Promise((resolve,reject)=>{waiting.push({resolve,reject});if(waiting.length===2)queueReady();});
 }};
 // Separate stores represent separate worker isolates; their local serialize
 // queues are deliberately independent. This is a model, not Hyperdrive itself.
 const first=createDocumentConsentStore(shared,docs),second=createDocumentConsentStore(shared,docs);
 const signup=store=>store.withCurrent(async()=>{
  const authConnection=await shared.connect();
  try {return 'authenticated';} finally {authConnection.release();}
 });
 const one=signup(first),two=signup(second);
 const outcomes=Promise.allSettled([one,two]);
 await bothWaiting;
 assert.equal(active,2,'both upstream slots are held by lock transactions');
 assert.equal(waiting.length,2,'both auth handlers are waiting for another slot');
 assert.equal(peak,2);
 // Release the synthetic requests deterministically, as an upstream connection
 // timeout would, without claiming a real timeout or a live service interaction.
 for(const waiter of waiting)waiter.reject(new Error('synthetic upstream acquisition timeout'));
 const results=await outcomes;
 assert.ok(results.every(r=>r.status==='rejected'));
 assert.equal(active,0,'lock connections are returned after both failures');
});

test('signup admission rejects another worker before the auth handler runs',async()=>{
 const {createDocumentConsentStore}=await import('./document-consents.mjs');
 let admissionHeld=false,attempts=0,handlerCalls=0,active=0,started,releaseFirst;
 const firstStarted=new Promise(resolve=>{started=resolve});
 const hold=new Promise(resolve=>{releaseFirst=resolve});
 const shared={query:async()=>({rows:[]}),connect:async()=>{
  let ownsAdmission=false;active++;
  return {query:async(sql)=>{
   if(sql.includes('pg_try_advisory_xact_lock')){attempts++;if(admissionHeld)return {rows:[{acquired:false}]};admissionHeld=true;ownsAdmission=true;return {rows:[{acquired:true}]};}
   if(sql.startsWith('SELECT document_type,version FROM member_auth_support.document_current'))return {rows:docs.map(({type,version})=>({document_type:type,version}))};
   if((sql==='COMMIT'||sql==='ROLLBACK')&&ownsAdmission){admissionHeld=false;ownsAdmission=false;}
   return {rows:[]};
  },release(){active--;}};
 }};
 const first=createDocumentConsentStore(shared,docs),second=createDocumentConsentStore(shared,docs);
 const running=first.withCurrent(async()=>{handlerCalls++;started();await hold;return 200;},{signup:true});
 await firstStarted;
 await assert.rejects(second.withCurrent(async()=>{handlerCalls++;},{signup:true}),/Signup temporarily busy/);
 assert.equal(attempts,2);assert.equal(handlerCalls,1);assert.equal(active,1);
 releaseFirst();assert.equal(await running,200);assert.equal(active,0);
});
