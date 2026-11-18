import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createAdvertiserSessionHandoff,observeAdvertiserSession} from './advertiser-session-handoff.mjs';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(){
 let principal={userId,sessionBinding:'session-a'},request={requestId,userId,status:'pending_review',revision:0,accountId:'123',advertiserId:'owner'}, closed=0,claimed=0,ran=0;
 const lease={page:{},requestId,userId,sessionBinding:'session-a',revision:0,accountId:'123',advertiserId:'owner',close:async()=>{closed++;}};
 const service=createAdvertiserSessionHandoff({auth:{verify:async()=>principal},requests:{get:async()=>request},broker:{claim:async()=>{claimed++;return lease;}},observe:async()=>true});
 return {service,lease,setPrincipal:x=>{principal=x;},setRequest:x=>{request=x;},counts:()=>({closed,claimed,ran}),run:async()=>{ran++;return {status:'observed'};}};
}
test('binds a server request to a single broker lease and always closes it',async()=>{
 const f=fixture();assert.deepEqual(await f.service({requestId,token:'token',run:f.run}),{status:'observed'});assert.deepEqual(f.counts(),{closed:1,claimed:1,ran:1});
});
test('rejects cross-user requests and cross-session leases before running',async()=>{
 let f=fixture();f.setRequest({requestId,userId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',status:'pending_review',accountId:'123',advertiserId:'owner'});assert.deepEqual(await f.service({requestId,token:'t',run:f.run}),{status:'blocked'});assert.equal(f.counts().claimed,0);
 f=fixture();f.lease.sessionBinding='other';assert.deepEqual(await f.service({requestId,token:'t',run:f.run}),{status:'blocked'});assert.deepEqual(f.counts(),{closed:1,claimed:1,ran:0});
});
test('session revocation during observation and exceptions never run work',async()=>{
 let f=fixture(),calls=0,closed=0,ran=0;
 const service=createAdvertiserSessionHandoff({auth:{verify:async()=>++calls===1?{userId,sessionBinding:'s'}:null},requests:{get:async()=>({requestId,userId,status:'pending_review',revision:0,accountId:'123',advertiserId:'owner'})},broker:{claim:async()=>({requestId,userId,sessionBinding:'s',revision:0,accountId:'123',advertiserId:'owner',page:{},close:async()=>{closed++;}})},observe:async()=>true});
 assert.deepEqual(await service({requestId,token:'t',run:async()=>{ran++;}}),{status:'blocked'});assert.equal(closed,1);assert.equal(ran,0);
 assert.deepEqual(await f.service({requestId:'bad',token:'t',run:f.run}),{status:'blocked'});assert.equal(f.counts().claimed,0);
});
test('request revision change while acquiring the lease blocks work',async()=>{
 let reads=0,closed=0,ran=0;
 const service=createAdvertiserSessionHandoff({auth:{verify:async()=>({userId,sessionBinding:'s'})},requests:{get:async()=>({requestId,userId,status:'pending_review',revision:reads++,accountId:'123',advertiserId:'owner'})},broker:{claim:async()=>({requestId,userId,sessionBinding:'s',revision:0,accountId:'123',advertiserId:'owner',page:{},close:async()=>{closed++;}})},observe:async()=>true});
 assert.deepEqual(await service({requestId,token:'t',run:async()=>{ran++;}}),{status:'blocked'});assert.equal(closed,1);assert.equal(ran,0);
});
test('a callback failure after work starts is uncertain with retry disabled',async()=>{
 const f=fixture();let sideEffect=0;
 const result=await f.service({requestId,token:'t',run:async()=>{sideEffect++;throw Error('response lost');}});
 assert.deepEqual(result,{status:'uncertain',retry:'disabled'});assert.equal(sideEffect,1);assert.equal(f.counts().closed,1);
});
let puppeteer;try {puppeteer=process.env.INVITATION_PUPPETEER_ROOT?createRequire(process.env.INVITATION_PUPPETEER_ROOT+'/package.json')('puppeteer-core'):await import('puppeteer-core');}catch{}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
test('observes only the expected profile and advertiser account on an isolated browser fixture',{skip:!puppeteer||!executablePath},async()=>{
 const browser=await puppeteer.launch({executablePath,headless:true,args:['--no-sandbox']});
 try {const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',r=>{void r.respond({status:200,contentType:'text/html; charset=utf-8',body:'<a href="https://ads.naver.com/settings/profile-info">owner</a><button>회원 초대</button>'});});await page.goto('https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');
 assert.equal(await observeAdvertiserSession({page,accountId:'123',advertiserId:'owner'}),true);
 assert.equal(await observeAdvertiserSession({page,accountId:'124',advertiserId:'owner'}),false);
 assert.equal(await observeAdvertiserSession({page,accountId:'123',advertiserId:'other'}),false);
 await page.goto('https://ads.naver.com.evil.test/manage/ad-accounts/123/settings/authorities/members/invited');assert.equal(await observeAdvertiserSession({page,accountId:'123',advertiserId:'owner'}),false);
 } finally {await browser.close();}
});
