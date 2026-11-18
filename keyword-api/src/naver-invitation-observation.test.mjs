import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {observePendingInvitation,observeAcceptedMembership} from './naver-invitation-observation.mjs';
let puppeteer;
try { puppeteer=process.env.INVITATION_PUPPETEER_ROOT?createRequire(process.env.INVITATION_PUPPETEER_ROOT+'/package.json')('puppeteer-core'):await import('puppeteer-core'); } catch {}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
const skip=!puppeteer||!executablePath;
const senderBase='<a href="https://ads.naver.com/settings/profile-info">operator</a><div role="tab" aria-selected="true">초대 중인 회원 1</div>';
const recipientBase='<a href="https://ads.naver.com/settings/profile-info">recipient</a><div role="tab" aria-selected="true">초대 받은 광고 계정</div>';
const senderRow='<tr><td>recipient</td><td>운영 관리</td><td>2026.11.18.</td><td>초대 취소</td></tr>';
const recipientRow='<tr><td>( 123 ) 상점</td><td>운영 관리</td><td>2026.11.18.</td><td><button>승인</button></td></tr>';
async function pages(senderHtml,recipientHtml,fn){
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try {
  const create=async(body,url)=>{const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{void r.respond({status:200,contentType:'text/html; charset=utf-8',body})});await page.goto(url);return page};
  const advertiserPage=await create(senderHtml,'https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/inviting');
  const recipientPage=await create(recipientHtml,'https://ads.naver.com/settings/ad-account/invited');
  return await fn({advertiserPage,recipientPage,accountId:'123',viewerId:'operator',recipientId:'recipient'});
 } finally {await browser.close()}
}
test('matching invitation rows in both sessions are observations, not verified evidence',{skip},async()=>pages(senderBase+`<table>${senderRow}</table>`,recipientBase+`<table>${recipientRow}</table>`,async args=>{
 const observed=await observePendingInvitation(args);
 assert.deepEqual(observed,{status:'pending_observed_unattributed',accountId:'123',recipientId:'recipient',role:'OPERATIONS_MANAGER'});
 assert.equal(observed.verified,undefined);assert.equal(observed.invitationId,undefined);
}));
test('missing, duplicated or mismatched rows cannot establish pending observation',{skip},async()=>{
 for(const [s,r] of [[senderRow+senderRow,recipientRow],[senderRow,recipientRow+recipientRow],[senderRow+senderRow.replace('운영 관리','운영 조회'),recipientRow],[senderRow,recipientRow+recipientRow.replace('운영 관리','운영 조회')],[senderRow,recipientRow.replace('123','124')],[senderRow.replace('운영 관리','운영 조회'),recipientRow],[senderRow,recipientRow.replace('운영 관리','운영 조회')]]) {
  await pages(senderBase+`<table>${s}</table>`,recipientBase+`<table>${r}</table>`,async args=>assert.deepEqual(await observePendingInvitation(args),{status:'unverified'}));
 }
});
test('same page for both parties or malformed account is refused before evaluating',async()=>{
 const page={evaluate:()=>{throw Error('should not evaluate')}};
 assert.deepEqual(await observePendingInvitation({advertiserPage:page,recipientPage:page,accountId:'123',viewerId:'operator',recipientId:'recipient'}),{status:'unverified'});
 assert.deepEqual(await observeAcceptedMembership({advertiserPage:page,accountId:'../123',viewerId:'operator',recipientId:'recipient'}),{status:'unverified'});
});
test('active membership remains unattributed to the current request',{skip},async()=>{
 const html='<a href="https://ads.naver.com/settings/profile-info">operator</a><div role="tab" aria-selected="true">권한 받은 회원 1</div><table><tr><td>recipient</td><td>운영 관리</td><td>date</td><td>정상</td><td>권한 해제</td></tr></table>';
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try {const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{void r.respond({status:200,contentType:'text/html; charset=utf-8',body:html})});await page.goto('https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');const value=await observeAcceptedMembership({advertiserPage:page,accountId:'123',viewerId:'operator',recipientId:'recipient'});assert.equal(value.status,'active_member_observed_unattributed');assert.equal(value.verified,undefined);assert.equal(value.invitationId,undefined);} finally {await browser.close()}
});
