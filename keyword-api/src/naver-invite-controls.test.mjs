import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createNaverInviteControls} from './naver-invite-controls.mjs';
import {createNaverAcceptControls} from './naver-accept-controls.mjs';
let puppeteer;try{puppeteer=process.env.INVITATION_PUPPETEER_ROOT?createRequire(process.env.INVITATION_PUPPETEER_ROOT+'/package.json')('puppeteer-core'):await import('puppeteer-core')}catch{}
const exe=process.env.INVITATION_CHROMIUM_PATH, skip=!puppeteer||!exe;
async function fixture(path,html,fn){const browser=await puppeteer.launch({executablePath:exe,headless:true,args:['--no-sandbox']});try{const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{void r.respond({status:200,contentType:'text/html; charset=utf-8',body:html})});await page.goto('https://ads.naver.com'+path);await fn(page)}finally{await browser.close()}}
const anchor='<a href="https://ads.naver.com/settings/profile-info">operator</a>';
// The real page has a search field behind the member invitation modal.
const inviteHtml=anchor+`<input type="text" value="background-search"><button>다음</button><div role="dialog" aria-label="회원 초대" id="content"><p>회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.</p><input type="text"><button onclick="document.querySelector('#result').innerText='초대 가능한 회원 ID입니다.';document.querySelector('#next').disabled=false">가입 여부 조회</button><p id="result"></p><button id="next" disabled onclick="document.querySelector('#content').innerHTML='<p>ID recipient 의 권한 레벨을 선택해 주세요.</p><label><input type=radio name=role checked>운영 관리</label><label><input type=radio name=role>운영 조회</label><button onclick=window.sent=true>초대</button>'">다음</button></div>`;
test('prepares exact target and requires authorization before a one-shot invitation', {skip}, async()=>fixture('/manage/ad-accounts/123/settings/authorities/members/invited',inviteHtml,async page=>{
 let allowed=false;const control=createNaverInviteControls({page,accountId:'123',viewerId:'operator',recipientId:'recipient',authorize:async()=>allowed});
 assert.equal((await control.prepareRecipient()).status,'ready');assert.equal((await control.send()).status,'blocked');assert.equal(await page.evaluate(()=>window.sent),undefined);
 allowed=true;assert.equal((await control.send()).status,'uncertain');assert.equal(await page.evaluate(()=>window.sent),true);assert.equal((await control.send()).status,'blocked');
}));
test('account mismatch prevents recipient entry', {skip}, async()=>fixture('/manage/ad-accounts/123/settings/authorities/members/invited',inviteHtml,async page=>{
 const control=createNaverInviteControls({page,accountId:'124',viewerId:'operator',recipientId:'recipient'});assert.equal((await control.prepareRecipient()).status,'unverified');assert.equal(await page.$eval('[role=dialog] input',e=>e.value),'');
}));
test('rejects ambiguous invitation dialogs without changing either input', {skip}, async()=>fixture('/manage/ad-accounts/123/settings/authorities/members/invited',inviteHtml.replace('</div>', '</div><div role="dialog" aria-label="회원 초대"><input type="text"></div>'),async page=>{
 const control=createNaverInviteControls({page,accountId:'123',viewerId:'operator',recipientId:'recipient'});
 assert.equal((await control.prepareRecipient()).status,'unverified');
 assert.deepEqual(await page.$$eval('[role=dialog] input',xs=>xs.map(x=>x.value)),['','']);
}));
const acceptHtml=anchor+`<table><tr><td>( 123 ) Test</td><td>운영 관리</td><td>date</td><td><button onclick="document.querySelector('#modal').innerHTML='<div role=dialog>광고 계정 초대를 승인하시겠습니까?<button onclick=window.accepted=true>확인</button></div>'">승인</button></td></tr></table><div id="modal"></div>`;
test('accepts only the matching account and permission after authorization', {skip}, async()=>fixture('/settings/ad-account/invited',acceptHtml,async page=>{
 const denied=createNaverAcceptControls({page,accountId:'124',recipientId:'operator',authorize:async()=>true});assert.equal((await denied.accept()).status,'blocked');
 const control=createNaverAcceptControls({page,accountId:'123',recipientId:'operator',authorize:async()=>true});assert.equal((await control.accept()).status,'uncertain');assert.equal(await page.evaluate(()=>window.accepted),true);assert.equal((await control.accept()).status,'blocked');
}));
