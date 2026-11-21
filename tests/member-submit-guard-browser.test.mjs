// Local synthetic browser fixture; external network requests are blocked.
import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {build} from 'esbuild';
const require=createRequire(import.meta.url),playwrightPath=process.env.KITS_PLAYWRIGHT_PATH;
test('repeated immediate submissions send one request and retry after completion',{skip:!playwrightPath,timeout:30000},async t=>{
 const {chromium}=require(playwrightPath);const built=await build({entryPoints:[fileURLToPath(new URL('./fixtures/member-submit-guard-browser.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent'});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'application/javascript'});return res.end(built.outputFiles[0].text);}res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div><script src="/app.js"></script></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());await page.goto(origin);
 await page.getByLabel('이메일',{exact:true}).fill('example@example.test');await page.getByLabel('비밀번호',{exact:true}).fill('example-password');
 await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 assert.equal(await page.evaluate(()=>window.formFixture.calls()),1);
 await page.evaluate(()=>window.formFixture.finish());await page.getByRole('alert').waitFor();
 await page.getByRole('button',{name:'이메일 로그인'}).click();assert.equal(await page.evaluate(()=>window.formFixture.calls()),2);
});
