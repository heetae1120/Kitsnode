// Real Supabase SDK and GoTrue; all HTTP requests are pinned to a Docker test
// network via a fixed docker-exec/curl bridge. No hosted network is contacted.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {createMemberSupabaseAuthCandidate} from '../../keyword-api/src/member-supabase-auth-candidate.mjs';
import {createMemberDocumentReceiptCandidate} from '../../keyword-api/src/member-document-receipt-candidate.mjs';
import {createAtomicCompletionServiceCandidate} from '../../keyword-api/src/member-atomic-completion-service-candidate.mjs';

const db=process.argv[2];
if(!/^kits-auth-member-[0-9]+-[0-9]+-db$/.test(db||''))throw Error('unsafe_container');
const project='http://127.0.0.1:65432', secret='local-test-only-secret-key-at-least-thirty-two-characters';
const email='adapter-member@example.test', password='SyntheticOnly-123456!';
const json=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const signed=payload=>{const value=`${json({alg:'HS256',typ:'JWT'})}.${json(payload)}`;return `${value}.${createHmac('sha256',secret).update(value).digest('base64url')}`};
const anon=signed({role:'anon',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600});
function run(cmd,args,input){const p=spawnSync(cmd,args,{input,encoding:'utf8',maxBuffer:1_000_000,timeout:15000});if(p.error||p.status!==0)throw Error(`local_command_failed:${cmd}`);return p.stdout;}
function docker(args,input){return run('docker',['exec','-i',db,...args],input);}
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function verifiedClaims(token){
 try{const [a,b,c,...extra]=token.split('.');if(extra.length||!a||!b||!c)return null;const actual=Buffer.from(c,'base64url'),expected=createHmac('sha256',secret).update(`${a}.${b}`).digest();if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const h=JSON.parse(Buffer.from(a,'base64url'));const p=JSON.parse(Buffer.from(b,'base64url'));if(h.alg!=='HS256'||p.exp<=Date.now()/1000||!uuid(p.sub)||!uuid(p.session_id))return null;return p;}catch{return null;}
}
function activeSession({accessToken,expectedUserId}){
 const claims=verifiedClaims(accessToken);if(!claims||claims.sub!==expectedUserId)return false;
 const sql=`select exists(select 1 from auth.sessions where id='${claims.session_id}' and user_id='${claims.sub}' and (not_after is null or not_after>now()))`;
 return docker(['psql','-U','supabase_admin','-d','postgres','-Atqc',sql]).trim()==='t';
}
async function isolatedFetch(input,init={}){
 const original=new URL(typeof input==='string'?input:input.url);
 if(original.origin!==project||!original.pathname.startsWith('/auth/v1/'))throw Error('unexpected_destination');
 const target=`http://auth:9999${original.pathname.slice('/auth/v1'.length)}${original.search}`;
 const args=['curl','-sS','--max-time','10','-X',init.method||'GET'];
 const headers=new Headers(init.headers);for(const [key,value] of headers)args.push('-H',`${key}: ${value}`);
 let body=init.body;if(body!==undefined&&body!==null){if(typeof body!=='string')throw Error('unexpected_body');args.push('--data-binary','@-');}else body=undefined;
 args.push('-w','\n__KITS_STATUS__%{http_code}',target);
 const result=docker(args,body);const at=result.lastIndexOf('\n__KITS_STATUS__');if(at<0)throw Error('missing_status');
 const status=Number(result.slice(at+16));if(!Number.isInteger(status)||status<100||status>599)throw Error('invalid_status');
 const content=result.slice(0,at);return new Response([204,205,304].includes(status)?null:content,{status,headers:{'content-type':'application/json'}});
}
async function revokeExactSession({accessToken}){
 const claims=verifiedClaims(accessToken);if(!claims)return false;
 const response=await isolatedFetch(`${project}/auth/v1/logout?scope=local`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`}});
 return response.ok&&!activeSession({accessToken,expectedUserId:claims.sub});
}
const observedSignup=[];
const createScoped=(url,key,opts)=>{const client=createClient(url,key,{...opts,global:{fetch:isolatedFetch}});const signup=client.auth.signUp.bind(client.auth);client.auth.signUp=async (...args)=>{const result=await signup(...args);const u=result?.data?.user;observedSignup.push({userId:u?.id||null,identityCount:Array.isArray(u?.identities)?u.identities.length:null,errorCode:result?.error?.code||null,hasSession:Boolean(result?.data?.session)});return result};return client};
const adapter=createMemberSupabaseAuthCandidate({createClient:createScoped,projectUrl:project,expectedProjectUrl:project,publicKey:anon,redirectTo:'http://localhost/store/login/',expectedRedirectOrigin:'http://localhost',activeSession,revokeExactSession});
const evidence={termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver',termsAccepted:true,privacyAcknowledged:true};
const registration=await adapter.signUp({email,password,evidence});assert.equal(registration.accepted,true);assert.ok(uuid(registration.userId));
assert.equal(await adapter.signInWithPassword({email,password}),null,'unconfirmed user must not sign in');
let mailbox='';for(let i=0;i<40;i++){try{mailbox=docker(['cat','/tmp/kits-mailbox']);if(mailbox.includes('verify?'))break;}catch{}await delay(250);}
const parser=`import sys,email,html,re\nfrom email import policy\nm=email.message_from_binary_file(sys.stdin.buffer,policy=policy.default)\nfor p in m.walk():\n if p.is_multipart(): continue\n try:\n  t=p.get_content()\n  if not isinstance(t,str): t=t.decode('utf-8','replace')\n except Exception: continue\n x=re.search(r'http://auth:9999/verify\\?[^\\s\\x22\\x27<>]+',html.unescape(t))\n if x:\n  print(x.group(0));break\n`;
const confirmation=run('python3',['-c',parser],mailbox).trim();
assert.ok(confirmation.startsWith('http://auth:9999/verify?'),'local confirmation missing');
const confirmationStatus=docker(['curl','-sS','-o','/dev/null','-w','%{http_code}',confirmation]).trim();assert.match(confirmationStatus,/^[23]/);
assert.equal(await adapter.signInWithPassword({email,password:'wrong-password'}),null,'wrong password must fail');
const first=await adapter.signInWithPassword({email,password});assert.equal(first?.user?.id,registration.userId);assert.equal(first.user.emailConfirmed,true);
const second=await adapter.signInWithPassword({email,password});assert.equal(second?.user?.id,registration.userId);
assert.ok(first.session.access_token!==second.session.access_token,'sessions must differ');
assert.equal((await adapter.verifySession(first.session.access_token))?.id,registration.userId);
// The document source and key below are synthetic. The service and receipt
// logic, JWT verification, local Auth, PostgREST, and atomic candidate are real.
let documents={terms:{version:'terms1',bytes:Buffer.from('시험 이용약관 원문','utf8')},privacy:{version:'privacy1',bytes:Buffer.from('시험 개인정보 안내 원문','utf8')},revision:1};
const hash=v=>createHash('sha256').update(v).digest('hex');
const metadata=()=>({termsVersion:documents.terms.version,privacyVersion:documents.privacy.version,termsSha256:hash(documents.terms.bytes),privacySha256:hash(documents.privacy.bytes),revision:documents.revision});
function putInitialMetadata(){const d=metadata();docker(['psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',`insert into kitsnode_member_private.member_active_documents_candidate values(true,'terms1','privacy1','${d.termsSha256}','${d.privacySha256}',${d.revision})`]);}
putInitialMetadata();
const receiptSession=async token=>{const u=await adapter.verifySession(token);const claims=verifiedClaims(token);return u&&claims ? {id:u.id,sessionId:claims.session_id}:null;};
const receiptService=createMemberDocumentReceiptCandidate({verifySession:receiptSession,readActiveDocuments:async()=>documents,keys:{test:Buffer.alloc(32,3)},activeKeyId:'test'});
let rpcCalls=0;
const atomicAdapter={contract:'member-atomic-completion-v1',complete:async ({token,profile,documents:d,termsAccepted,privacyAccepted,ageConfirmed})=>{
 rpcCalls++;
 const body=JSON.stringify({p_username:profile.username,p_name:profile.name,p_phone:profile.phone,p_expected_email:profile.email,p_terms_version:d.termsVersion,p_privacy_version:d.privacyVersion,p_document_revision:d.revision,p_terms_sha256:d.termsSha256,p_privacy_sha256:d.privacySha256,p_terms_accepted:termsAccepted,p_privacy_accepted:privacyAccepted,p_age_confirmed:ageConfirmed});
 const raw=docker(['curl','-sS','--max-time','10','-X','POST','-H','Content-Type: application/json','-H',`Authorization: Bearer ${token}`,'--data-binary','@-','http://api:3000/rpc/complete_profile'],body);
 const result=JSON.parse(raw);if(typeof result!=='string')throw Error(`local_rpc_${result?.code||'unknown'}`);return result;
}};
const service=createAtomicCompletionServiceCandidate({readActiveDocuments:async()=>metadata(),verifySession:token=>adapter.verifySession(token),verifyDocumentReceipt:receiptService.verifyDocumentReceipt,atomicAdapter});
const inp=d=>({name:'홍길동',username:'seller_01',email,phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:d.termsVersion,privacyVersion:d.privacyVersion});
const firstReceipt=await receiptService.issue({token:first.session.access_token});
assert.equal(firstReceipt.ok,true);assert.equal(firstReceipt.documents.terms.body,'시험 이용약관 원문');assert.equal(firstReceipt.metadata.termsSha256,hash(documents.terms.bytes));
const badSession=await service.complete({token:second.session.access_token,input:inp(firstReceipt.metadata),documents:firstReceipt.metadata,documentReceipt:firstReceipt.receipt});
assert.equal(badSession.ok,false);assert.equal(badSession.code,'document_unverified');assert.equal(rpcCalls,0);
// Update the authoritative document and revision in BOTH synthetic source and
// test DB; the old receipt cannot be reused even with the same version strings.
documents={...documents,terms:{...documents.terms,bytes:Buffer.from('바뀐 시험 이용약관','utf8')},revision:2};
const current=metadata();docker(['psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update kitsnode_member_private.member_active_documents_candidate set terms_sha256='${current.termsSha256}',revision=2 where singleton=true`]);
const stale=await service.complete({token:first.session.access_token,input:inp(firstReceipt.metadata),documents:firstReceipt.metadata,documentReceipt:firstReceipt.receipt});
assert.equal(stale.ok,false);assert.equal(stale.code,'document_unverified');assert.equal(rpcCalls,0);
const oldInput={username:'seller_01',name:'홍길동',phone:'010-1234-5678',email};
const directStale=await atomicAdapter.complete({token:first.session.access_token,profile:oldInput,documents:firstReceipt.metadata,termsAccepted:true,privacyAccepted:true,ageConfirmed:true});
assert.equal(directStale,'document_changed');
const count=()=>docker(['psql','-U','supabase_admin','-d','postgres','-Atqc',`select (select count(*) from public.kitsnode_member_consents where user_id='${registration.userId}' and terms_version='terms1') || ':' || (select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='${registration.userId}') || ':' || (select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='${registration.userId}')`]).trim();
assert.equal(count(),'0:0:0','stale document must not create new consent/evidence/profile');
// Old RPCs are deliberately exposed only as test wrappers; the underlying
// functions must deny authenticated invocation in this disposable stack.
const oldBody=JSON.stringify({p_username:'bypass_id',p_name:'홍길동',p_phone:'010-1234-5678',p_age_confirmed:true,p_expected_email:email});
for(const endpoint of ['old_profile','old_session_profile']){
 const status=docker(['curl','-sS','-o','/dev/null','-w','%{http_code}','-X','POST','-H','Content-Type: application/json','-H',`Authorization: Bearer ${first.session.access_token}`,'--data-binary','@-',`http://api:3000/rpc/${endpoint}`],oldBody).trim();
 assert.ok(['401','403'].includes(status),`legacy test RPC ${endpoint} unexpectedly allowed`);
}
assert.equal(await adapter.revokeSession(first.session),true);
const revoked=await service.complete({token:first.session.access_token,input:inp(firstReceipt.metadata),documents:firstReceipt.metadata,documentReceipt:firstReceipt.receipt});
assert.equal(revoked.ok,false);assert.equal(revoked.code,'verification_required');
const directRevoked=await atomicAdapter.complete({token:first.session.access_token,profile:oldInput,documents:current,termsAccepted:true,privacyAccepted:true,ageConfirmed:true});
assert.equal(directRevoked,'unauthenticated');assert.equal(count(),'0:0:0','revoked session must not create records');
// A fresh receipt for the still-active second session can complete atomically.
const issued=await receiptService.issue({token:second.session.access_token});assert.equal(issued.ok,true);
assert.equal(issued.documents.terms.body,'바뀐 시험 이용약관');assert.equal(issued.metadata.termsSha256,current.termsSha256);
const before=rpcCalls;
const complete=await service.complete({token:second.session.access_token,input:inp(issued.metadata),documents:issued.metadata,documentReceipt:issued.receipt});
assert.deepEqual(complete,{ok:true,code:'profile_completed'});assert.equal(rpcCalls,before+1);assert.equal(count(),'1:1:1');
const saved=docker(['psql','-U','supabase_admin','-d','postgres','-Atqc',`select count(*) from kitsnode_member_private.member_completion_evidence_candidate where user_id='${registration.userId}' and document_revision=2 and terms_sha256='${current.termsSha256}' and privacy_sha256='${current.privacySha256}'`]).trim();assert.equal(saved,'1','stored evidence must match served exact UTF-8 bytes');
assert.equal(await adapter.revokeSession(second.session),true);
console.log('Actual Auth JWT + test-only PostgREST: exact document receipt and atomic profile/consent, stale document, other session, logout and legacy denial passed');
