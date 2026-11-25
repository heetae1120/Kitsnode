import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const playwrightPath=process.env.KITS_PLAYWRIGHT_PATH;
const path=name=>fileURLToPath(new URL(name,import.meta.url));

test('manual invite request uses the session and does not ask for an ad account ID', {skip:!playwrightPath,timeout:30000},async t=>{
 const {chromium}=require(playwrightPath);
 const built=await build({entryPoints:[path('./fixtures/manual-invite-request-browser.tsx')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'process.env.NEXT_PUBLIC_AD_MANUAL_INVITE_REQUEST_ENABLED':'"true"'},alias:{'@/lib/member-browser-client':path('./fixtures/manual-invite-auth-stub.ts')}});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage();const states={'Bearer fixture.token':'none','Bearer other.token':'none'},calls=[];
 await page.route('**/*',async route=>{
  const req=route.request();if(new URL(req.url()).origin===origin)return route.continue();
  if(req.url()==='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/manual-invite-requests'){
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type'}});
   calls.push({method:req.method(),body:req.postData(),auth:req.headers().authorization});
   const auth=req.headers().authorization;
   if(req.method()==='POST')states[auth]='pending_review';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:states[auth]}),headers:{'access-control-allow-origin':origin}});
  }
  return route.abort();
 });
 await page.goto(origin);
 await page.getByRole('button',{name:'광고계정 연결 확인 요청'}).click();
 await page.getByText('연결 확인을 요청했습니다. 광고계정과 권한을 확인하고 있습니다.').waitFor();
 assert.deepEqual(calls,[{method:'GET',body:null,auth:'Bearer fixture.token'},{method:'POST',body:'{}',auth:'Bearer fixture.token'}]);
 assert.equal(await page.locator('input').count(),0);
 states['Bearer fixture.token']='matched';
 await page.getByRole('button',{name:'테스트 새로고침'}).click();
 await page.getByText('요청이 연결 검토 목록에 등록되었습니다. 위 연결 상태에서 진행 결과를 확인해 주세요.').waitFor();
 states['Bearer fixture.token']='none';
 await page.getByRole('button',{name:'테스트 새로고침'}).click();
 await page.getByRole('button',{name:'광고계정 연결 확인 요청'}).waitFor();
 // A completed connection does not block requesting another account.
 await page.getByRole('button',{name:'테스트 계정 전환'}).click();
 await page.getByRole('button',{name:'광고계정 연결 확인 요청'}).waitFor();
 assert.equal(await page.getByText('요청이 연결 검토 목록에 등록되었습니다. 위 연결 상태에서 진행 결과를 확인해 주세요.').count(),0);
 await page.getByRole('button',{name:'광고계정 연결 확인 요청'}).click();
 await page.getByText('연결 확인을 요청했습니다. 광고계정과 권한을 확인하고 있습니다.').waitFor();
 assert.ok(calls.some(call=>call.method==='GET'&&call.auth==='Bearer other.token'));
 assert.ok(calls.some(call=>call.method==='POST'&&call.auth==='Bearer other.token'&&call.body==='{}'));
});

test('operator confirms the advertiser account before moving a request to review', {skip:!playwrightPath,timeout:30000},async t=>{
 const {chromium}=require(playwrightPath);
 const built=await build({entryPoints:[path('./fixtures/manual-invite-review-browser.tsx')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'process.env.NEXT_PUBLIC_AD_MANUAL_INVITE_REQUEST_ENABLED':'"true"'},alias:{'@/lib/member-browser-client':path('./fixtures/ad-connection-auth-stub.ts')}});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><div id="root"></div><script src="/app.js"></script>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage(),calls=[];
 const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',memberId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',connectionId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await page.route('**/*',async route=>{
  const req=route.request();if(new URL(req.url()).origin===origin)return route.continue();
  if(req.url()==='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/manual-invite-reviews'){
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, content-type'}});
   const body=req.postDataJSON();calls.push(body);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body.action==='queue'?{requests:[{request_id:requestId,user_id:memberId,created_at:'2026-01-01T00:00:00Z'}]}:{status:'matched',connectionId}),headers:{'access-control-allow-origin':origin}});
  }
  return route.abort();
 });
 await page.goto(origin);await page.getByRole('button',{name:'초대 확인 요청 불러오기'}).click();await page.getByRole('button',{name:'계정 확인'}).click();
 await page.getByLabel('확인한 네이버 광고계정 ID').fill('12345');
 assert.equal(await page.getByRole('button',{name:'연결 검토에 등록'}).isDisabled(),true);
 await page.getByLabel('신청한 광고주와 이 계정의 관계를 별도로 확인했습니다.').check();
 await page.getByRole('button',{name:'연결 검토에 등록'}).click();
 await page.getByText(/아래 목록에서 확인 기록을 저장하고 승인/).waitFor();
 assert.deepEqual(calls,[{action:'queue'},{action:'attach',requestId,adAccountId:'12345',confirmed:true}]);
});

test('manual pending changes the main step without overriding a connected account', {skip:!playwrightPath,timeout:30000},async t=>{
 const {chromium}=require(playwrightPath);
 const built=await build({entryPoints:[path('./fixtures/advertiser-analysis-browser.tsx')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'process.env.NEXT_PUBLIC_AD_MANUAL_INVITE_REQUEST_ENABLED':'"true"','process.env.NEXT_PUBLIC_AD_CONNECTION_ENABLED':'"true"','process.env.NEXT_PUBLIC_AD_AUTO_CONNECT_ENABLED':'"false"','process.env.NEXT_PUBLIC_AD_ANALYSIS_PERFORMANCE_READY':'"false"','process.env.NEXT_PUBLIC_AD_PERFORMANCE_ENABLED':'"false"','process.env.NEXT_PUBLIC_BASE_PATH':'""','process.env':'{}'},alias:{'@/lib/member-browser-client':path('./fixtures/ad-connection-auth-stub.ts'),'next/link':path('./fixtures/ad-connection-link-stub.tsx'),'@/lib/member-return':path('../src/lib/member-return.ts')}});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<!doctype html><div class="store-theme"><div id="root"></div></div><script src="/app.js"></script>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>console.error(error.message));let connected=false;
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();
  if(u.hostname==='bjpguxwqxlsteektkhwf.supabase.co'){
   const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, content-type'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const data=u.pathname.endsWith('/manual-invite-requests')?{status:'pending_review'}:{connections:connected?[{requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',adAccountId:'12345',status:'read_connected'}]:[]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers});
  }
  return route.abort();
 });
 await page.goto(origin);await page.getByRole('button',{name:'1단계 광고계정 연결, 확인 대기'}).waitFor();
 connected=true;await page.reload();await page.getByRole('button',{name:'1단계 광고계정 연결, 연결 완료'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'1단계 광고계정 연결, 확인 대기'}).count(),0);
});
