import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareNaverInviteDialog} from './naver-invite-dialog.mjs';
let puppeteer;
try { puppeteer = process.env.INVITATION_PUPPETEER_ROOT ? createRequire(process.env.INVITATION_PUPPETEER_ROOT + '/package.json')('puppeteer-core') : await import('puppeteer-core'); } catch {}
const path=process.env.INVITATION_CHROMIUM_PATH;
const skip=!puppeteer||!path;
async function fixture({viewer='advertiser',url='https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited',extra=''}={},fn){
 const browser=await puppeteer.launch({executablePath:path,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();await page.setRequestInterception(true);
  page.on('request',r=>{void r.respond({status:200,contentType:'text/html; charset=utf-8',body:`<a href="https://ads.naver.com/settings/profile-info">${viewer}</a><button id="open">회원 초대</button>${extra}<script>document.querySelector('#open').addEventListener('click',()=>{document.querySelector('#opened').textContent='opened'})</script><span id="opened">none</span>`})});
  await page.goto(url);await fn({page,accountId:'123',viewerId:'advertiser'});
 }finally{await browser.close();}
}
test('opens only the invitation dialog in the matched advertiser session', {skip},async()=>fixture({},async input=>{
 assert.deepEqual(await prepareNaverInviteDialog(input),{status:'dialog_open_requested',next:'user_policy_review'});
 assert.equal(await input.page.$eval('#opened',e=>e.textContent),'opened');
}));
test('rejects mismatched account, viewer, origin and ambiguous controls', {skip},async()=>{
 for(const options of [{viewer:'other'},{url:'https://ads.naver.com/manage/ad-accounts/124/settings/authorities/members/invited'},{url:'https://ads.naver.com.evil.test/manage/ad-accounts/123/settings/authorities/members/invited'},{extra:'<button>회원 초대</button>'}]) await fixture(options,async input=>{
  assert.deepEqual(await prepareNaverInviteDialog(input),{status:'unverified'});
  assert.equal(await input.page.$eval('#opened',e=>e.textContent),'none');
 });
});
test('rejects malformed ids before visiting the page',async()=>{
 let called=false;const page={evaluate(){called=true}};
 assert.deepEqual(await prepareNaverInviteDialog({page,accountId:'../1',viewerId:'advertiser'}),{status:'unverified'});
 assert.equal(called,false);
});
