import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {verifyNaverRecipientSession} from './naver-recipient-session.mjs';
let puppeteer;
try { puppeteer = process.env.INVITATION_PUPPETEER_ROOT ? createRequire(process.env.INVITATION_PUPPETEER_ROOT+'/package.json')('puppeteer-core') : await import('puppeteer-core'); } catch {}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
test('requires the expected visible Naver profile and origin', {skip:!puppeteer||!executablePath}, async()=>{
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', r=>{void r.respond({status:200,contentType:'text/html',body:'<a href="https://ads.naver.com/settings/profile-info">kitsnode</a>'});});
  await page.goto('https://ads.naver.com/settings/profile-info');
  assert.equal(await verifyNaverRecipientSession({page,recipientId:'kitsnode'}),true);
  assert.equal(await verifyNaverRecipientSession({page,recipientId:'other'}),false);
  await page.goto('https://ads.naver.com.evil.test/settings/profile-info');
  assert.equal(await verifyNaverRecipientSession({page,recipientId:'kitsnode'}),false);
 } finally {await browser.close();}
});
test('rejects invalid IDs and failed page reads',async()=>{
 assert.equal(await verifyNaverRecipientSession({page:{evaluate:async()=>{throw Error('private');}},recipientId:'kitsnode'}),false);
 assert.equal(await verifyNaverRecipientSession({page:{evaluate:async()=>true},recipientId:'../bad'}),false);
});
