import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),pw=process.env.KITS_PLAYWRIGHT_PATH;
test('verified identity completes the draft; changed identity and collisions fail safely',{skip:!pw,timeout:30000},async t=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('./fixtures/member-signup-draft-profile.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent'});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html'});res.end('<div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await require(pw).chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(origin);await page.getByText('회원 정보가 등록되어 있습니다.').waitFor();
 let calls=await page.evaluate(()=>window.fixture.calls);assert.equal(calls.length,1);assert.equal(calls[0].input.p_company,'Example');assert.equal(calls[0].input.p_expected_user,'11111111-1111-4111-8111-111111111111');
 await page.goto(origin+'/?different');await page.getByRole('heading',{name:'회원 정보 등록'}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.calls.length),0);
 await page.goto(origin+'/?taken');await page.getByText(/인증하는 동안 아이디가 사용됐습니다/).waitFor();assert.equal(await page.getByLabel('아이디').inputValue(),'seller_one');assert.equal(await page.getByLabel('업체명 (선택)').inputValue(),'Example');
});
