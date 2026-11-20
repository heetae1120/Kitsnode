// Real Supabase SDK and GoTrue; all HTTP requests are pinned to a Docker test
// network via a fixed docker-exec/curl bridge. No hosted network is contacted.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {createClient} from '@supabase/supabase-js';
import {createMemberSupabaseAuthCandidate} from '../../keyword-api/src/member-supabase-auth-candidate.mjs';
import {createMemberOnboardingCandidate,createSignupDraftCodec} from '../../keyword-api/src/member-onboarding-candidate.mjs';

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
// Mixed-provider mismatch is tested using only synthetic local DB metadata.
// The Auth user still retains an email identity, but email-primary policy must
// match the candidate DB function's provider predicate.
assert.ok(uuid(registration.userId));
docker(['psql','-U','supabase_admin','-d','postgres','-c',`update auth.users set raw_app_meta_data=jsonb_set(raw_app_meta_data,'{provider}','"custom:naver"'::jsonb) where id='${registration.userId}'`]);
assert.equal(await adapter.verifySession(first.session.access_token),null,'email identity alone must not pass when Naver is primary');
docker(['psql','-U','supabase_admin','-d','postgres','-c',`update auth.users set raw_app_meta_data=jsonb_set(raw_app_meta_data,'{provider}','"email"'::jsonb) where id='${registration.userId}'`]);
assert.equal((await adapter.verifySession(first.session.access_token))?.id,registration.userId);
// The limiter/availability check remain synthetic; the profile write goes to
// a test-only PostgREST wrapper using the real signed session JWT.
const completions=[]; let rpcDiagnostic='not_called';
const profiles={
  isUsernameAvailable:async()=>true,
  complete:async value=>{
    completions.push({subject:value.subject});
    const body=JSON.stringify({p_username:value.username,p_name:value.name,p_phone:value.phone,p_age_confirmed:value.ageConfirmed,p_expected_email:value.expectedEmail});
    const raw=docker(['curl','-sS','--max-time','10','-X','POST','-H','Content-Type: application/json','-H',`Authorization: Bearer ${value.token}`,'--data-binary','@-','http://api:3000/rpc/complete_profile'],body);
    const result=JSON.parse(raw);if(typeof result!=='string'){rpcDiagnostic=String(result?.code||'unknown');throw Error('local_rpc_failed');}rpcDiagnostic=result;return result;
  },
};
const service=createMemberOnboardingCandidate({auth:adapter,profiles,limit:{consume:async()=>true},codec:createSignupDraftCodec({key:Buffer.alloc(32,7)}),limitKey:Buffer.alloc(32,8),termsVersion:evidence.termsVersion,privacyVersion:evidence.privacyVersion});
const input={name:'홍길동',username:'seller_01',password,passwordConfirmation:password,email,phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:evidence.termsVersion,privacyVersion:evidence.privacyVersion};
const duplicate=await service.register({clientKey:'local-client',input});
const newSignup=await service.register({clientKey:'local-client',input:{...input,email:'new-second@example.test'}});
assert.equal(duplicate.ok,true);assert.equal(newSignup.ok,true);assert.equal(duplicate.code,'signup_requested');assert.equal(newSignup.code,duplicate.code);
const duplicateRaw=observedSignup[1],newRaw=observedSignup[2];
assert.equal(duplicateRaw?.errorCode,null);assert.equal(newRaw?.errorCode,null);assert.equal(duplicateRaw?.hasSession,false);assert.equal(newRaw?.hasSession,false);
assert.notEqual(duplicateRaw.userId,registration.userId,'verified duplicate must not expose existing real ID');
assert.equal(duplicateRaw.identityCount,0,'verified duplicate should return obfuscated empty identities');
assert.ok(newRaw.identityCount>0,'new account should carry an email identity');
const deniedDraft=await service.inspectDraft({clientKey:'local-client',token:first.session.access_token,draft:duplicate.draft});
assert.equal(deniedDraft.ok,false);assert.equal(deniedDraft.code,'verification_required','fake signup subject must not bind to the real account');
const consentRows=docker(['psql','-U','supabase_admin','-d','postgres','-Atqc',`select count(*) from public.kitsnode_member_consents where user_id='${registration.userId}'`]).trim();
assert.equal(consentRows,'1','real Auth signup must persist existing consent trigger');
const manual=await service.completeManual({clientKey:'local-client',token:first.session.access_token,input});
assert.equal(manual.ok,true,`manual result ${manual.code}, local RPC ${rpcDiagnostic}`);assert.equal(manual.code,'profile_completed');assert.equal(completions.length,1);assert.equal(completions[0].subject,registration.userId);
const created=docker(['psql','-U','supabase_admin','-d','postgres','-Atqc',`select count(*) from kitsnode_member_private.member_signup_profiles_candidate where user_id='${registration.userId}' and username='seller_01'`]).trim();
assert.equal(created,'1','real JWT-backed PostgREST must persist profile');
const retry=await service.completeManual({clientKey:'local-client',token:first.session.access_token,input});
assert.equal(retry.ok,true);assert.equal(retry.code,'profile_completed');
const changed=await service.completeManual({clientKey:'local-client',token:first.session.access_token,input:{...input,name:'다른 이름'}});
assert.equal(changed.ok,false,'same username with different profile is not an idempotent retry');
assert.equal(await adapter.revokeSession(first.session),true);
assert.equal(await adapter.verifySession(first.session.access_token),null,'revoked session must fail');
assert.equal((await adapter.verifySession(second.session.access_token))?.id,registration.userId,'other session remains active');
assert.equal(await adapter.revokeSession(second.session),true);
console.log('Actual SDK + local GoTrue/PostgREST: signup, email confirmation, consent trigger, duplicate response, guarded manual profile, two sessions and exact-session revocation passed; limiter and availability were mocked');
