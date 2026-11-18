import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareActiveTab,inviteStep,executeInviteStep} from './preflight.mjs';
let chromium;try{const p=process.env.INVITATION_PLAYWRIGHT_ROOT;chromium=(p?createRequire(p+'/package.json')('playwright'):await import('playwright')).chromium}catch{}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
const skip=!chromium||!executablePath;
const url='https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited';
async function fixture(body,run){
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();await page.route('**/*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<a href="https://ads.naver.com/settings/profile-info">advertiser</a>${body}`}));await page.goto(url);await run(page);}finally{await browser.close()}
}
test('preflight rejects other origins or paths before injection',async()=>{
 let calls=0;const api={tabs:{query:async()=>[{id:1,url:'https://ads.naver.com.evil.test/'}]},scripting:{executeScript:async()=>{calls++}}};
 assert.equal(await prepareActiveTab(api),'wrong_page');assert.equal(await executeInviteStep(api,'send'),'unverified');assert.equal(calls,0);
});
test('refuses a different active tab before the final action',async()=>{
 let calls=0;const api={tabs:{query:async()=>[{id:2,url}]},scripting:{executeScript:async()=>{calls++}}};
 assert.equal(await executeInviteStep(api,'send',url,1),'unverified');assert.equal(calls,0);
});
test('viewer lookup supplies JSON-serializable null for its optional binding',async()=>{
 const api={tabs:{query:async()=>[{id:1,url}]},scripting:{executeScript:async({args})=>{
  if(args.some(x=>x===undefined))throw Error('unserializable');
  assert.deepEqual(args,['viewer',url,null]);return [{result:'viewer:advertiser'}];
 }}};
 assert.equal(await executeInviteStep(api,'viewer',url,1),'viewer:advertiser');
});
test('optional URL and viewer arguments are both JSON serializable',async()=>{
 const api={tabs:{query:async()=>[{id:1,url}]},scripting:{executeScript:async({args})=>{
  if(args.some(x=>x===undefined))throw Error('unserializable');
  assert.deepEqual(args,['lookup',null,null]);return [{result:'recipient_filled'}];
 }}};
 assert.equal(await executeInviteStep(api,'lookup'),'recipient_filled');
});
test('opens invitation dialog only on unique verified page',{skip},async()=>fixture('<button onclick="this.textContent=\'opened\'">회원 초대</button>',async page=>{
 assert.equal(await page.evaluate(inviteStep,'send'),'unverified');
 const {openInviteDialog}=await import('./preflight.mjs');assert.equal(await page.evaluate(openInviteDialog),'dialog_requested');assert.equal(await page.locator('button').textContent(),'opened');
}));
test('does not invite the kitsnode account from its own session',{skip},async()=>fixture('<button>회원 초대</button>',async page=>{
 await page.locator('a').evaluate(e=>{e.textContent='kitsnode'});
 const {openInviteDialog}=await import('./preflight.mjs');assert.equal(await page.evaluate(openInviteDialog),'unverified');
}));
test('fills only fixed recipient and requires lookup confirmation before advancing',{skip},async()=>fixture('<div role="dialog" aria-label="회원 초대"><p>회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.</p><input><button>가입 여부 조회</button><button>다음</button></div>',async page=>{
 assert.equal(await page.evaluate(inviteStep,'lookup'),'recipient_filled');assert.equal(await page.locator('input').inputValue(),'kitsnode');assert.equal(await page.evaluate(inviteStep,'next'),'unverified');
}));
test('requires exact account, recipient and selected role immediately before send',{skip},async()=>fixture('<div role="dialog" aria-label="회원 초대"><p>ID kitsnode 의 권한 레벨을 선택해 주세요.</p><label><input type="radio" name="role" checked>운영 관리</label><label><input type="radio" name="role">운영 조회</label><button onclick="this.textContent=\'sent\'">초대</button></div>',async page=>{
 assert.equal(await page.evaluate(inviteStep,'viewer'),'viewer:advertiser');
 assert.equal(await page.evaluate(`(${inviteStep.toString()})('inspect_send',${JSON.stringify(url)},'advertiser')`),'ready');
 assert.equal(await page.evaluate(inviteStep,'send'),'unverified');
 assert.equal(await page.evaluate(`(${inviteStep.toString()})('send',${JSON.stringify(url)},'other')`),'unverified');
 assert.equal(await page.evaluate(`(${inviteStep.toString()})('send','https://ads.naver.com/manage/ad-accounts/999/settings/authorities/members/invited')`),'unverified');
 assert.equal(await page.evaluate(`(${inviteStep.toString()})('send',${JSON.stringify(url)},'advertiser')`),'send_attempted');assert.equal(await page.locator('button').textContent(),'sent');
}));
test('stops if the signed-in advertiser changes after confirmation',{skip},async()=>fixture('<div role="dialog" aria-label="회원 초대"><p>ID kitsnode 의 권한 레벨을 선택해 주세요.</p><label><input type="radio" name="role" checked>운영 관리</label><label><input type="radio" name="role">운영 조회</label><button onclick="this.textContent=\'sent\'">초대</button></div>',async page=>{
 assert.equal(await page.evaluate(inviteStep,'viewer'),'viewer:advertiser');
 await page.locator('a').evaluate(e=>{e.textContent='other'});
 assert.equal(await page.evaluate(`(${inviteStep.toString()})('send',${JSON.stringify(url)},'advertiser')`),'unverified');
 assert.equal(await page.locator('button').textContent(),'초대');
}));
