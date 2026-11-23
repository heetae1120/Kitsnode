import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),pw=process.env.KITS_PLAYWRIGHT_PATH;
test('authenticated email owner can set an available username; other sessions cannot',{skip:!pw,timeout:30000},async t=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('./fixtures/member-username-setup-browser.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_BASE_PATH':'""'}});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html'});res.end('<div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await require(pw).chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());const page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>console.error(error.message));
 await page.goto(origin);await page.getByLabel('이름',{exact:true}).fill('Synthetic');await page.getByLabel('아이디',{exact:true}).fill('duplicate');await page.getByRole('button',{name:'아이디 중복 확인'}).click();await page.getByText('이미 사용 중인 아이디입니다.').waitFor();assert.equal(await page.getByRole('button',{name:'회원 정보 저장'}).isDisabled(),true);
 await page.getByLabel('아이디',{exact:true}).fill('admin_test');await page.getByRole('button',{name:'아이디 중복 확인'}).click();await page.getByText('사용 가능한 아이디입니다.').waitFor();await page.getByLabel('휴대폰 번호',{exact:true}).fill('01012345678');await page.getByRole('checkbox',{name:'만 14세 이상입니다.'}).check();await page.getByRole('button',{name:'회원 정보 저장'}).click();await page.getByText('아이디 설정이 완료되었습니다.').waitFor();assert.equal(await page.evaluate(()=>window.setupCalls.length),1);
 for(const [scenario,message] of [['signedout','로그인'],['mismatch','계정 상태를 확인하지 못했습니다.'],['naver','이메일 인증이 완료된 이메일 계정에서 사용할 수 있습니다.']]){await page.goto(origin+'/?case='+scenario);await page.getByText(message,{exact:false}).first().waitFor();assert.equal(await page.evaluate(()=>window.setupCalls.length),0)}
});
