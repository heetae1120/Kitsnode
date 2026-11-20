// Run: KITS_PLAYWRIGHT_PATH=/absolute/path/to/playwright node --test tests/member-signup-browser.test.mjs
// All network requests except the local fixture are blocked; no Supabase or Naver service is used.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const playwrightPath=process.env.KITS_PLAYWRIGHT_PATH;
const chromePath=process.env.KITS_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('signup handles stale, unavailable, failed, retried username checks and submits only the confirmed value', {skip:!playwrightPath,timeout:30000}, async t=>{
  const {chromium}=require(playwrightPath);
  const built=await build({entryPoints:[fileURLToPath(new URL('./fixtures/member-signup-browser.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent'});
  const script=built.outputFiles[0].text;
  const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(script);return;}if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div><script src="/app.js"></script></html>');return;}res.writeHead(404);res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:chromePath});
  t.after(()=>browser.close());
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin);
  const username=page.getByLabel('아이디',{exact:true});
  const check=page.getByRole('button',{name:'아이디 중복 확인'});
  const submit=page.getByRole('button',{name:'일반 회원가입'});
  await username.fill('first_id'); await check.click();
  assert.equal(await page.getByText('아이디를 확인하고 있습니다.').count(),1);
  await username.fill('second_id');
  await page.evaluate(()=>window.signupFixture.resolve(0,{ok:true,code:'available'}));
  assert.equal(await submit.isDisabled(),true);
  assert.equal(await page.getByText('사용 가능한 아이디입니다.').count(),0);
  await check.click(); await page.evaluate(()=>window.signupFixture.resolve(1,{ok:true,code:'unavailable'}));
  await page.getByText('이미 사용 중인 아이디입니다.').waitFor();
  await check.click(); await page.evaluate(()=>window.signupFixture.resolve(2,{ok:false,code:'unavailable'}));
  await page.getByText('아이디 형식을 확인하거나 잠시 후 다시 시도해 주세요.').waitFor();
  await check.click(); await page.evaluate(()=>window.signupFixture.resolve(3,{ok:true,code:'available'}));
  await page.getByText('사용 가능한 아이디입니다.').waitFor();
  await page.getByLabel('이름',{exact:true}).fill('홍길동');
  await page.getByLabel('비밀번호',{exact:true}).fill('secure-password');
  await page.getByLabel('비밀번호 재확인',{exact:true}).fill('secure-password');
  await page.getByLabel('이메일',{exact:true}).fill('example@example.test');
  await page.getByLabel('휴대폰 번호',{exact:true}).fill('010-1234-5678');
  for(const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  assert.equal(await submit.isEnabled(),true);
  await page.getByLabel('휴대폰 번호',{exact:true}).fill('010-1234-\t5678');
  await submit.click();
  await page.getByText('휴대폰 번호를 확인해 주세요.').waitFor();
  assert.equal(await page.evaluate(()=>window.signupFixture.registrations.length),0);
  await page.getByLabel('휴대폰 번호',{exact:true}).fill('010-1234-5678');
  await submit.click();
  await page.getByText(/요청을 처리했습니다\. 인증 메일을 확인/).waitFor();
  const result=await page.evaluate(()=>window.signupFixture.registrations.map(({username,termsAccepted,privacyAccepted,ageConfirmed})=>({username,termsAccepted,privacyAccepted,ageConfirmed})));
  assert.deepEqual(result,[{username:'second_id',termsAccepted:true,privacyAccepted:true,ageConfirmed:true}]);
  // A successfully sent email must not be reported as an error when local draft
  // storage fails; the authenticated member can re-enter their profile later.
  await page.evaluate(()=>{window.signupFixture.manual=true;});
  await page.getByLabel('비밀번호',{exact:true}).fill('secure-password');
  await page.getByLabel('비밀번호 재확인',{exact:true}).fill('secure-password');
  await submit.click();
  await page.getByText(/인증 후 회원 정보를 다시 입력해야 할 수 있습니다/).waitFor();
  assert.equal(await page.getByRole('alert').count(),0);
});
