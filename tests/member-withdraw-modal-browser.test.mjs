import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const require=createRequire(import.meta.url),pw=process.env.KITS_PLAYWRIGHT_PATH;
test('confirmation dialog cancels safely and confirms without extra input',{skip:!pw,timeout:30000},async t=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('./fixtures/member-withdraw-modal-browser.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent'});
 const server=createServer((req,res)=>{if(req.url==='/app.js'){res.writeHead(200,{'content-type':'text/javascript'});return res.end(built.outputFiles[0].text)}res.writeHead(200,{'content-type':'text/html'});res.end('<div id="root"></div><script src="/app.js"></script>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,browser=await require(pw).chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(origin);
 await page.getByRole('button',{name:'회원 탈퇴',exact:true}).click();await page.getByRole('dialog').waitFor();
 assert.equal(await page.getByRole('dialog').getByRole('textbox').count(),0);
 await page.getByRole('button',{name:'취소'}).click();assert.equal(await page.evaluate(()=>window.withdrawCalls),0);
 await page.getByRole('button',{name:'회원 탈퇴',exact:true}).click();await page.getByRole('button',{name:'탈퇴하기'}).click();
 await page.getByText('회원 탈퇴가 완료되었습니다. 다시 이용하려면 회원가입해 주세요.').waitFor();assert.equal(await page.evaluate(()=>window.withdrawCalls),1);
});
