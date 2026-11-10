// Single-process loopback test: Naver auth is ephemeral SQLite, while the two
// test consents are stored in the explicitly restricted hosted test schema.
// The in-memory mailbox is not an actual delivery provider.
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {toNodeHandler} from 'better-auth/node';
import {getMigrations} from 'better-auth/db/migration';
import pg from 'pg';
import {createDevNaverAuth} from './auth.mjs';
import {createPostgresMemberApp} from './app.mjs';
import {createIsolatedConsentPool} from './isolated-consent-pool.mjs';

const origin='http://127.0.0.1:4323';
export const testDocuments=[
 {type:'terms',version:'local-terms-test-0.1',text:readFileSync(new URL('./fixture-service-terms.txt',import.meta.url),'utf8')},
 {type:'privacy',version:'local-privacy-test-0.1',text:readFileSync(new URL('./fixture-privacy.txt',import.meta.url),'utf8')}
];
const page=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>회원가입 격리 시험</title><main><h1>회원가입 격리 시험</h1><p>시험 계정으로 진행하세요. 인증 메일은 실제로 발송되지 않고 이 브라우저의 시험 수신함에서 확인합니다.</p><button id="login">네이버 로그인</button><section id="docs"></section><button id="agree">선택한 항목 동의 저장</button><button id="mail">시험 인증 메일 만들기</button><button id="open">시험 인증 링크 열기</button><button id="status">상태 확인</button><button id="logout">로그아웃</button><p id="result" role="status"></p></main><script>
const result=document.getElementById('result');let documents=[];
async function request(path,body){let r=await fetch(path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error();return r.json()}
async function status(){let s=await request('/api/member/session');result.textContent=s.authenticated?'로그인 완료 · 약관 '+(s.consentStatus.terms?'동의':'미동의')+' · 개인정보 '+(s.consentStatus.privacy?'동의':'미동의')+' · 이메일 '+(s.emailVerified?'인증':'미인증'):'로그인 전'}
document.getElementById('login').onclick=async()=>{try{let d=await request('/api/auth/sign-in/social',{provider:'naver',callbackURL:location.origin+'/test/'});let u=new URL(d.url);if(u.origin!=='https://nid.naver.com'||u.pathname!=='/oauth2.0/authorize')throw Error();location.assign(u.href)}catch{result.textContent='로그인을 시작하지 못했습니다.'}};
document.getElementById('agree').onclick=async()=>{try{let selections=documents.filter(d=>document.getElementById(d.type).checked).map(d=>({type:d.type,version:d.version,accepted:true}));await request('/api/member/consent',{consents:selections});await status()}catch{result.textContent='동의를 저장하지 못했습니다.'}};
document.getElementById('mail').onclick=async()=>{try{await request('/api/member/verify-email',{});result.textContent='시험 수신함에 인증 링크를 만들었습니다. 실제 메일 발송은 아닙니다.'}catch{result.textContent='시험 인증 링크를 만들지 못했습니다.'}};
document.getElementById('open').onclick=async()=>{try{let m=await request('/__test/mail');let u=new URL(m.url);if(u.origin!==location.origin||u.pathname!=='/api/auth/verify-email')throw Error();location.assign(u.href)}catch{result.textContent='시험 인증 링크를 확인하지 못했습니다.'}};
document.getElementById('status').onclick=()=>status().catch(()=>{result.textContent='상태를 확인하지 못했습니다.'});document.getElementById('logout').onclick=async()=>{try{await request('/api/auth/sign-out',{});await status()}catch{result.textContent='로그아웃하지 못했습니다.'}};
request('/api/member/terms').then(d=>{documents=d.documents;let target=document.getElementById('docs');documents.forEach(d=>{let label=document.createElement('label'),box=document.createElement('input'),title=document.createElement('strong'),text=document.createElement('pre');box.type='checkbox';box.id=d.type;title.textContent=d.type==='terms'?'이용약관':'개인정보 수집·이용 동의';text.textContent=d.text;label.append(box,title,text);target.append(label)})}).then(status).catch(()=>{result.textContent='시험 문서를 불러오지 못했습니다.'});</script></html>`;

export async function createIsolatedNaverServer({pool,clientId,clientSecret,fetchImpl=fetch,sendMail,frontendOrigin=origin,testRecipient}) {
 if(process.env.NODE_ENV==='production'||!clientId||!clientSecret) throw new Error('Isolated development configuration required');
 if(![origin,'http://127.0.0.1:4324'].includes(frontendOrigin))throw new Error('Test frontend must be loopback');
 const isolated=await createIsolatedConsentPool(pool);
 const db=new DatabaseSync(':memory:'); let mailbox=null;
 try {
  const {auth,handle}=createDevNaverAuth({database:db,baseURL:origin,secret:randomBytes(32).toString('hex'),trustedOrigins:[origin,frontendOrigin],
   sendMail:sendMail|| (async mail=>{mailbox={to:mail.to,url:mail.url};}),naver:{clientId,clientSecret},fetchImpl});
  await (await getMigrations((await auth.$context).options)).runMigrations();
  const app=await createPostgresMemberApp({auth:{api:auth.api,handler:handle},pool:isolated,documents:testDocuments,allowedOrigins:[origin,frontendOrigin],naverCallbackURLs:[frontendOrigin===origin?origin+'/test/':frontendOrigin+'/store/login/'],emailAvailable:true,accountLimit:async()=>true,naverIdentityLookup:async userId => !!db.prepare("SELECT 1 FROM account a WHERE a.userId=? AND a.providerId='naver' AND length(a.accountId)>0 AND NOT EXISTS (SELECT 1 FROM account b WHERE b.userId=? AND b.providerId<>'naver') LIMIT 1").get(userId,userId)});
  const handler=async request=>{
   const url=new URL(request.url); if(url.origin!==origin)return new Response('Forbidden',{status:403});
   const safe={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"};
   if(url.pathname==='/test/'&&request.method==='GET')return new Response(page,{headers:{...safe,'content-type':'text/html; charset=utf-8'}});
   if(url.pathname==='/__test/mail'&&request.method==='GET'){
    // An exact same-origin header and the same authenticated user are required.
    if(request.headers.get('sec-fetch-site')!=='same-origin') return new Response('Forbidden',{status:403,headers:safe});
    const session=await auth.api.getSession({headers:request.headers});
    if(!session?.user?.email||!mailbox||session.user.email!==mailbox.to)return new Response('Not found',{status:404,headers:safe});
    return Response.json({url:mailbox.url},{headers:safe});
   }
   const allowed=new Set(['/api/auth/sign-in/social','/api/auth/sign-out','/api/auth/callback/naver','/api/auth/verify-email','/api/member/terms','/api/member/session','/api/member/consent','/api/member/private','/api/member/verify-email']);
   if(testRecipient){allowed.add('/api/auth/sign-up/email');allowed.add('/api/auth/sign-in/email');}
   if(!allowed.has(url.pathname))return new Response('Not found',{status:404,headers:safe});
   if(request.method==='POST'&&['/api/auth/sign-up/email','/api/auth/sign-in/email'].includes(url.pathname)){
    try{const body=await request.clone().json();if(typeof body.email!=='string'||body.email.toLowerCase()!==testRecipient.toLowerCase())throw Error('forbidden');}
    catch{return new Response('Forbidden',{status:403,headers:safe});}
   }
   const response=await app(request);for(const [k,v] of Object.entries(safe))response.headers.set(k,v);return response;
  };
  return {server:createServer(toNodeHandler(handler)),handler,db};
 } catch(error){db.close();throw error;}
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 if(process.env.MEMBER_AUTH_ISOLATED_TEST!=='1'||process.env.NODE_ENV==='production')throw new Error('Isolated test is disabled');
 const {TEST_DATABASE_URL,TEST_DATABASE_CA,NAVER_CLIENT_ID,NAVER_CLIENT_SECRET}=process.env;
 let u;try{u=new URL(TEST_DATABASE_URL)}catch{throw new Error('Test database URL required')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||!u.username||!u.password||u.search||u.hash||!TEST_DATABASE_CA?.includes('BEGIN CERTIFICATE'))throw new Error('Verified TLS test database configuration required');
 const pool=new pg.Pool({connectionString:TEST_DATABASE_URL,ssl:{ca:TEST_DATABASE_CA,rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000});
 try {
  const {server,db}=await createIsolatedNaverServer({pool,clientId:NAVER_CLIENT_ID,clientSecret:NAVER_CLIENT_SECRET});
  server.listen(4323,'127.0.0.1',()=>process.stdout.write('Isolated test: http://127.0.0.1:4323/test/\n'));
  const stop=()=>server.close(async()=>{db.close();await pool.end();process.exit(0)});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
 } catch(e){await pool.end();throw e;}
}
