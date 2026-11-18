import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createInviteBrowserFixture} from './invite-browser-fixture.mjs';

// Explicit test dependency can be supplied by the caller; no downloaded browser
// or real Naver endpoint is used. Other environments can skip this integration.
const runtime=process.env.INVITATION_PLAYWRIGHT_ROOT;
let chromium;
try{chromium=(runtime?createRequire(runtime+'/package.json')('playwright'):await import('playwright')).chromium}catch{}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
const available=!!chromium&&!!executablePath;
const html=await readFile(new URL('../test-fixtures/invite-browser-fixture.html',import.meta.url),'utf8');
async function fixture(run){
 const server=createServer((req,res)=>{if(req.url!=='/fixture.html'){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const fixtureOrigin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).origin===fixtureOrigin?route.continue():route.abort());
  const page=await context.newPage();await page.goto(fixtureOrigin+'/fixture.html');
  await run({page,fixtureOrigin});await context.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
function client(page,fixtureOrigin,overrides={}){return createInviteBrowserFixture({page,fixtureOrigin,accountId:'123',recipientId:'fixture-recipient',...overrides})}

test('fixture invitation and independently supplied recipient session require exact account and role', {skip:!available},async()=>fixture(async({page,fixtureOrigin})=>{
 assert.deepEqual(await client(page,fixtureOrigin).invite(),{ok:true,status:'invited',retry:'disabled'});
 const recipientContext=await page.context().browser().newContext();
 try{
  await recipientContext.route('**/*',route=>new URL(route.request().url()).origin===fixtureOrigin?route.continue():route.abort());
  const recipientPage=await recipientContext.newPage();await recipientPage.goto(fixtureOrigin+'/fixture.html');
  await recipientPage.getByTestId('session-mode').evaluate(el=>el.textContent='recipient');
  assert.deepEqual(await client(recipientPage,fixtureOrigin).accept(),{ok:true,status:'accepted',retry:'disabled'});
 }finally{await recipientContext.close()}
}));
test('wrong account, recipient, session, role or challenge fail before button', {skip:!available},async()=>fixture(async({page,fixtureOrigin})=>{
 for(const [id,value] of [['account-id','456'],['recipient-id','other'],['session-mode','recipient'],['role','운영 조회'],['challenge','captcha']]){
  const loc=page.getByTestId(id),old=await loc.textContent();await loc.evaluate((el,v)=>el.textContent=v,value);
  assert.equal((await client(page,fixtureOrigin).invite()).reason,'context_unverified');assert.equal(await page.getByTestId('result').textContent(),'ready');await loc.evaluate((el,v)=>el.textContent=v,old);
 }
}));
test('uncertain result is terminal and cannot be retried', {skip:!available},async()=>fixture(async({page,fixtureOrigin})=>{
 await page.getByTestId('send-invite').evaluate(el=>el.replaceWith(el.cloneNode(true)));
 const service=client(page,fixtureOrigin);assert.equal((await service.invite()).reason,'outcome_unconfirmed');assert.equal((await service.invite()).reason,'already_attempted');
}));
test('fixture module rejects provider origin and arbitrary destinations',async()=>{
 const fake={url:()=>'',getByTestId:()=>{}};
 for(const fixtureOrigin of ['https://ads.naver.com','http://localhost:3000','http://127.0.0.1:3000/path','http://example.com:3000'])assert.throws(()=>client(fake,fixtureOrigin),/fixture_only/);
});
