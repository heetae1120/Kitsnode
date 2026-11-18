import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { automaticInviteStep, prepareAutomaticInvite } from './automatic-invite.mjs';
let chromium; try { const p=process.env.INVITATION_PLAYWRIGHT_ROOT; chromium=(p?createRequire(p+'/package.json')('playwright'):await import('playwright')).chromium; } catch {}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
function fixture(overrides={}) {
 const calls=[];let policy=0;
 const stages={open:'opened',fill:'filled',lookup:'lookup_started',next:'next_started',role:'ready'};
 const input={accountId:'123',viewerId:'advertiser',consent:{accountId:'123',recipientId:'kitsnode',role:'OPERATIONS_MANAGER',approved:true},
 execute:async action=>{calls.push(action);return action==='policy'?(++policy===1?'policy_required':'policy_complete'):stages[action]},
 waitForPolicy:async()=>true,wait:async()=>{},send:async x=>{calls.push(['send',x]);},...overrides};
 return {calls,input};
}
test('after explicit consent and policy review advances every stage automatically',async()=>{
 const f=fixture();assert.deepEqual(await prepareAutomaticInvite(f.input),{status:'uncertain',retry:'disabled'});
 assert.deepEqual(f.calls.map(x=>Array.isArray(x)?x[0]:x),['open','policy','policy','fill','lookup','next','role','send']);
 assert.equal(f.calls.at(-1)[1].recipientId,'kitsnode');
});
test('wrong consent, advertiser or policy abort before sending',async()=>{
 for(const x of [{consent:{approved:true,accountId:'123',recipientId:'other',role:'OPERATIONS_MANAGER'}},{viewerId:'kitsnode'},{waitForPolicy:async()=>false}]){
  const f=fixture(x);const r=await prepareAutomaticInvite(f.input);assert.ok(['blocked','policy_required'].includes(r.status));assert.equal(f.calls.some(Array.isArray),false);
 }
});
test('ambiguous write is never reported successful or retried',async()=>{
 const f=fixture({send:async()=>{throw Error('timeout')}});assert.deepEqual(await prepareAutomaticInvite(f.input),{status:'uncertain',retry:'disabled'});
});
test('reports a pre-send verification failure instead of an ambiguous send',async()=>{
 for(const reason of ['tab_changed','viewer_unverified','role_unverified','previous_attempt','in_progress','unavailable','cancelled']){
  const f=fixture({send:async()=>({status:reason})});
  assert.deepEqual(await prepareAutomaticInvite(f.input),{status:'blocked',reason,retry:'disabled'});
 }
});
test('retries a blank input replaced during React rendering before querying the recipient',async()=>{
 let attempts=0;const calls=[];const values={open:'opened',policy:'policy_complete',fill:'filled',next:'next_started',role:'ready'};
 const f=fixture({execute:async action=>{calls.push(action);if(action==='lookup')return ++attempts===1?'refill':'lookup_started';return values[action]},send:async()=>{calls.push('send')}});
 assert.equal((await prepareAutomaticInvite(f.input)).status,'uncertain');
 assert.deepEqual(calls,['open','policy','fill','lookup','fill','lookup','next','role','send']);
});
test('recognizes when the user already advanced from policy to ID input',{skip:!chromium||!executablePath},async()=>{
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});try{
  const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<a href="https://ads.naver.com/settings/profile-info">advertiser</a><div role="dialog" aria-label="회원 초대"><p>회원으로 초대할 회원 ID(네이버 ID)를 정확히 입력해 주세요.</p><input><button disabled>가입 여부 조회</button><button disabled>다음</button></div>`}));
  await page.goto('https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'open',accountId:'123',viewerId:'advertiser'}),'opened');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'policy_inspect',accountId:'123',viewerId:'advertiser'}),'policy_advanced');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'policy',accountId:'123',viewerId:'advertiser'}),'policy_complete');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'fill',accountId:'123',viewerId:'advertiser'}),'filled');
  assert.equal(await page.locator('input').inputValue(),'kitsnode');
  await page.locator('input').fill('someone');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'fill',accountId:'123',viewerId:'advertiser'}),'unverified');
 }finally{await browser.close()}
});
test('in browser require advertiser, exact URL, fixed target and checked user policy', {skip:!chromium||!executablePath},async()=>{
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});try{
  const page=await browser.newPage();await page.route('**/*',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:`<a href="https://ads.naver.com/settings/profile-info">advertiser</a><div role="dialog" aria-label="회원 초대"><label><input type="checkbox">개인정보 제공 및 회원 초대 정책에 동의합니다</label><button>다음</button></div>`}));
  await page.goto('https://ads.naver.com/manage/ad-accounts/123/settings/authorities/members/invited');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'policy',accountId:'123',viewerId:'advertiser'}),'policy_required');
  assert.equal(await page.locator('input').isChecked(),false);
  await page.locator('input').check();assert.equal(await page.evaluate(automaticInviteStep,{action:'policy',accountId:'123',viewerId:'advertiser'}),'policy_complete');
  assert.equal(await page.evaluate(automaticInviteStep,{action:'policy',accountId:'124',viewerId:'advertiser'}),'unverified');
 }finally{await browser.close()}
});
