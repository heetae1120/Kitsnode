import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildJonho1TestExtension} from './build-jonho1-test.mjs';
let chromium;try{const p=process.env.INVITATION_PLAYWRIGHT_ROOT;chromium=(p?createRequire(p+'/package.json')('playwright'):await import('playwright')).chromium}catch{}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;

test('test package has fixed jonho1 and no web-controlled entry point',async()=>{
 const dir=await buildJonho1TestExtension();try{
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  assert.equal(manifest.externally_connectable,undefined);assert.equal(manifest.background,undefined);
  for(const name of ['preflight.mjs','send-invite.mjs','automatic-start.mjs','automatic-controller.mjs','automatic-driver.mjs','automatic-invite.mjs','popup.mjs','popup.html']){
   const content=await readFile(join(dir,name),'utf8');assert.equal(content.includes('kitsnode'),false,name);assert.ok(content.includes('jonho1'),name);
  }
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('test package continues from policy review through one jonho1 send attempt',async()=>{
 const dir=await buildJonho1TestExtension();try{
  const {prepareAutomaticInvite}=await import(pathToFileURL(join(dir,'automatic-invite.mjs')).href);const calls=[];
  const states={open:'opened',policy:'policy_complete',fill:'filled',lookup:'lookup_started',next:'next_started',role:'ready'};
  const result=await prepareAutomaticInvite({accountId:'123',viewerId:'kitsnode',consent:{accountId:'123',recipientId:'jonho1',role:'OPERATIONS_MANAGER',approved:true},
   execute:async action=>(calls.push(action),states[action]),waitForPolicy:async()=>true,wait:async()=>{},send:async expected=>{calls.push('send');assert.equal(expected.viewerId,'kitsnode');assert.equal(expected.recipientId,'jonho1');}});
  assert.deepEqual(result,{status:'uncertain',retry:'disabled'});assert.deepEqual(calls,['open','policy','fill','lookup','next','role','send']);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('test package accepts kitsnode as advertiser but fills only jonho1', {skip:!chromium||!executablePath},async()=>{
 const dir=await buildJonho1TestExtension();let browser;try{
  const {automaticInviteStep}=await import(pathToFileURL(join(dir,'automatic-invite.mjs')).href);
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<a href="https://ads.naver.com/settings/profile-info">kitsnode</a><div role="dialog" aria-label="회원 초대"><p>회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.</p><input></div>'}));
  await page.goto('https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'fill',accountId:'123',viewerId:'kitsnode'}),'filled');assert.equal(await page.locator('input').inputValue(),'jonho1');
 }finally{await browser?.close();await rm(dir,{recursive:true,force:true})}
});
test('test package recognizes exact jonho1 role with or without whitespace', {skip:!chromium||!executablePath},async()=>{
 const dir=await buildJonho1TestExtension();let browser;try{
  const {automaticInviteStep}=await import(pathToFileURL(join(dir,'automatic-invite.mjs')).href);
  const {inviteStep}=await import(pathToFileURL(join(dir,'preflight.mjs')).href);
  const url='https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited';
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<a href="https://ads.naver.com/settings/profile-info">kitsnode</a><div role="dialog" aria-label="회원 초대"><p>ID jonho1의 권한 레벨을 선택해 주세요.</p><label><input type="radio" name="r" checked>운영 관리</label><label><input type="radio" name="r">운영 조회</label><button>초대</button></div>'}));
  await page.goto(url);
  for(const text of ['ID jonho1의 권한 레벨을 선택해 주세요.','ID jonho1 의 권한 레벨을 선택해 주세요.']) {
   await page.locator('p').evaluate((e,value)=>{e.textContent=value},text);
   assert.equal(await page.evaluate(automaticInviteStep,{action:'open',accountId:'123',viewerId:'kitsnode'}),'role_opened');
   assert.equal(await page.evaluate(automaticInviteStep,{action:'role',accountId:'123',viewerId:'kitsnode'}),'ready');
   assert.equal(await page.evaluate(`(${inviteStep.toString()})('inspect_send',${JSON.stringify(url)},'kitsnode')`),'ready');
  }
  await page.locator('p').evaluate(e=>{e.textContent='ID jonho10의 권한 레벨을 선택해 주세요.'});
  assert.equal(await page.evaluate(automaticInviteStep,{action:'role',accountId:'123',viewerId:'kitsnode'}),'waiting');
  assert.equal(await page.evaluate(`(${inviteStep.toString()})('inspect_send',${JSON.stringify(url)},'kitsnode')`),'unverified');
 }finally{await browser?.close();await rm(dir,{recursive:true,force:true})}
});
test('test package resumes a correctly selected target at the role stage',async()=>{
 const dir=await buildJonho1TestExtension();try{
  const {prepareAutomaticInvite}=await import(pathToFileURL(join(dir,'automatic-invite.mjs')).href);const calls=[];
  const r=await prepareAutomaticInvite({accountId:'123',viewerId:'kitsnode',consent:{accountId:'123',recipientId:'jonho1',role:'OPERATIONS_MANAGER',approved:true},execute:async action=>(calls.push(action),action==='open'?'role_opened':action==='role'?'ready':'unverified'),waitForPolicy:async()=>{throw Error('not needed')},wait:async()=>{},send:async()=>{calls.push('send')}});
  assert.deepEqual(r,{status:'uncertain',retry:'disabled'});assert.deepEqual(calls,['open','role','send']);
 }finally{await rm(dir,{recursive:true,force:true})}
});
