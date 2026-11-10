// Local interactive bootstrap: provider credentials remain in process memory.
// Run only with an already provisioned, restricted test role.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {toNodeHandler} from 'better-auth/node';
import pg from 'pg';
import {createIsolatedNaverServer} from './isolated-naver-server.mjs';
import {createIsolatedSmtp} from './isolated-smtp.mjs';

if(process.env.MEMBER_AUTH_ISOLATED_TEST!=='1'||process.env.NODE_ENV==='production')throw new Error('Test bootstrap disabled');
const origin='http://127.0.0.1:4323';
const secretPath=process.env.TEST_DB_PASSWORD_FILE,caPath=process.env.TEST_DB_CA_FILE;
const host=process.env.TEST_DB_HOST,user=process.env.TEST_DB_USER;
const recipient=process.env.TEST_MAIL_RECIPIENT;
if(!secretPath||!caPath||!recipient||!/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host||'')||!/^kitsnode_auth_test_runtime\.[a-z0-9]+$/.test(user||''))throw new Error('Test credentials required');
const pool=new pg.Pool({host,port:5432,user,password:readFileSync(secretPath,'utf8'),database:'postgres',ssl:{ca:readFileSync(caPath,'utf8'),rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000});
let runtime=null, starting=false;
const safe={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const form=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>네이버 격리 시험 설정</title><h1>네이버 격리 시험 설정</h1><p>자격 증명은 이 컴퓨터의 시험 프로세스 메모리에서만 사용합니다.</p><form method="post" action="/start"><label>Client ID<input name="id" type="password" autocomplete="off" required></label><label>Client Secret<input name="secret" type="password" autocomplete="off" required></label><label>네이버 발신 이메일<input name="smtpUser" type="email" autocomplete="off" required></label><label>네이버 앱 비밀번호<input name="smtpPassword" type="password" autocomplete="off" required></label><button>시험 시작</button></form></html>`;
const handle=async request=>{
 const url=new URL(request.url); if(url.origin!==origin)return new Response('Forbidden',{status:403,headers:safe});
 if(runtime&&url.pathname==='/start')return Response.redirect('http://127.0.0.1:4324/store/signup/',303);
 if(runtime)return runtime.handler(request);
 if(request.method==='GET'&&url.pathname==='/')return new Response(form,{headers:{...safe,'content-type':'text/html; charset=utf-8'}});
 const requestOrigin=request.headers.get('origin');
 if(request.method!=='POST'||url.pathname!=='/start'||(requestOrigin && requestOrigin!==origin && requestOrigin!=='null')||request.headers.get('sec-fetch-site')!=='same-origin'||starting){
  console.error('Setup rejected:',JSON.stringify({requestOrigin,fetchSite:request.headers.get('sec-fetch-site')}));
  return new Response('Forbidden',{status:403,headers:safe});
 }
 const raw=await request.text();if(raw.length>4096)return new Response('Invalid',{status:400,headers:safe});
 const p=new URLSearchParams(raw);if(!p.get('id')||!p.get('secret')||!p.get('smtpUser')||!p.get('smtpPassword'))return new Response('Invalid',{status:400,headers:safe});
 starting=true;
 let phase='smtp_configuration';
 try{const sendMail=createIsolatedSmtp({user:p.get('smtpUser'),password:p.get('smtpPassword'),recipient,onFailure:({code,responseCode})=>console.error('Test SMTP failure:',JSON.stringify({code,responseCode}))});phase='smtp_authentication';await sendMail.verify();phase='test_runtime';runtime=await createIsolatedNaverServer({pool,clientId:p.get('id'),clientSecret:p.get('secret'),sendMail,testRecipient:recipient,frontendOrigin:'http://127.0.0.1:4324'});return Response.redirect('http://127.0.0.1:4324/store/signup/',303)}
 catch{console.error('Test setup failed at:',phase);return new Response(phase==='smtp_authentication'?'네이버 메일 인증에 실패했습니다. 발신 계정의 앱 비밀번호를 확인해 주세요.':phase==='smtp_configuration'?'메일 설정 입력 형식을 확인해 주세요.':'시험 서버 연결에 실패했습니다.',{status:503,headers:safe})}finally{starting=false}
};
const server=createServer(toNodeHandler(handle));server.listen(4323,'127.0.0.1',()=>process.stdout.write('Isolated setup ready at http://127.0.0.1:4323/\n'));
const stop=()=>server.close(async()=>{runtime?.db.close();await pool.end();process.exit(0)});
process.once('SIGINT',stop);process.once('SIGTERM',stop);
