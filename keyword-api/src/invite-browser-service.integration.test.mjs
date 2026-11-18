// Local-only integration: the in-memory HTTP server is a synthetic provider.
// No real credentials, Naver UI, app routes, or production store are used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createInviteAutomationCandidate} from './invite-automation-candidate.mjs';
import {createInviteBrowserFixture} from './invite-browser-fixture.mjs';

let chromium;
try{const p=process.env.INVITATION_PLAYWRIGHT_ROOT;chromium=(p?createRequire(p+'/package.json')('playwright'):await import('playwright')).chromium}catch{}
const executablePath=process.env.INVITATION_CHROMIUM_PATH;
const skip=!chromium||!executablePath;
const role='OPERATIONS_MANAGER',recipient='fixture-recipient',requestId='job1',account='123';

function render(mode,wrongRecipient){
 const shown=wrongRecipient?'other-recipient':recipient;
 // All variables are fixed test constants controlled by this test itself.
 return `<!doctype html><html><body>
 <span data-testid="session-mode">${mode}</span><span data-testid="account-id">${account}</span>
 <span data-testid="recipient-id">${shown}</span><span data-testid="role">운영 관리</span>
 <span data-testid="challenge">none</span><span data-testid="request-id">${requestId}</span>
 <span data-testid="invitation-id">inv-1</span><output data-testid="result">ready</output>
 <button data-testid="send-invite">초대</button><button data-testid="accept-invite">승인</button>
 <script>
 async function send(path){let body={requestId:'${requestId}',adAccountId:'${account}',recipientId:'${shown}',role:'${role}',invitationId:'inv-1'};
 let r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 document.querySelector('[data-testid="result"]').textContent=await r.text();}
 document.querySelector('[data-testid="send-invite"]').onclick=()=>send('/invite');
 document.querySelector('[data-testid="accept-invite"]').onclick=()=>send('/accept');
 </script></body></html>`;
}

async function fixture({wrongRecipient=false,uncertain=false,withdrawAfterInvite=false}={},run){
 const record={requestId,account,recipient,role,invitationId:'inv-1',invited:false,accepted:false,inviteCalls:0,acceptCalls:0};
 const job={userId:'user1',adAccountId:account,state:'pending_review',consent:true,revision:'1'};
 const server=createServer(async(req,res)=>{
  const session=req.headers['x-fixture-session'];
  if(req.method==='GET'&&req.url==='/fixture.html'&&['advertiser','recipient'].includes(session)){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(render(session,wrongRecipient&&session==='advertiser'));
  }
  if(req.method==='POST'&&['/invite','/accept'].includes(req.url)){
   let text='';for await(const chunk of req){text+=chunk;if(text.length>2048){res.writeHead(413);return res.end()}}
   let input;try{input=JSON.parse(text)}catch{res.writeHead(400);return res.end('bad')}
   const matches=input.requestId===record.requestId&&input.adAccountId===record.account&&input.recipientId===record.recipient&&input.role===record.role&&input.invitationId===record.invitationId;
   if(!matches){res.writeHead(403);return res.end('mismatch')}
   if(req.url==='/invite'&&session==='advertiser'&&!record.invited){record.inviteCalls++;record.invited=true;res.writeHead(200);return res.end(uncertain?'unknown':'invited')}
   if(req.url==='/accept'&&session==='recipient'&&record.invited&&!record.accepted){record.acceptCalls++;record.accepted=true;res.writeHead(200);return res.end('accepted')}
   res.writeHead(409);return res.end('denied');
  }
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const fixtureOrigin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try{
  browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
  async function session(mode){const ctx=await browser.newContext({extraHTTPHeaders:{'x-fixture-session':mode}});await ctx.route('**/*',route=>new URL(route.request().url()).origin===fixtureOrigin?route.continue():route.abort());const page=await ctx.newPage();await page.goto(fixtureOrigin+'/fixture.html');return {page,ctx};}
  const advertiser=await session('advertiser'),receiver=await session('recipient');
  let held=false,finished=[];
  const expectedEvidence=x=>({...x,verified:true,invitationId:record.invitationId});
  const deps={enabled:true,recipientId:recipient,role,
   auth:{verify:async token=>token==='token'?{userId:'user1',sessionBinding:'session1'}:null},
   identity:{verify:async x=>x.requestId===requestId&&x.adAccountId===account&&x.recipientId===recipient&&x.role===role},
   repository:{getJob:async id=>id===requestId?{...job}:null,reserve:async x=>{if(held||!job.consent||x.requestId!==requestId||x.adAccountId!==account)return false;held=true;return true},finish:async(id,status)=>finished.push([id,status])},
   provider:{
    invite:async x=>{
     if(x.requestId!==requestId||x.adAccountId!==account||x.recipientId!==recipient||x.role!==role||await advertiser.page.getByTestId('request-id').textContent()!==x.requestId)return null;
     const a=createInviteBrowserFixture({page:advertiser.page,fixtureOrigin,accountId:x.adAccountId,recipientId:x.recipientId});const r=await a.invite();
     if(withdrawAfterInvite)job.consent=false;
     return r.ok&&record.invited?expectedEvidence(x):null;
    },
    accept:async x=>{
     if(x.requestId!==requestId||x.invitationId!==record.invitationId||!record.invited||await receiver.page.getByTestId('invitation-id').textContent()!==x.invitationId)return null;
     const a=createInviteBrowserFixture({page:receiver.page,fixtureOrigin,accountId:x.adAccountId,recipientId:x.recipientId});const r=await a.accept();
     return r.ok&&record.accepted?expectedEvidence(x):null;
    }
   }};
  const service=createInviteAutomationCandidate(deps);await run({service,record,job,finished});
  await advertiser.ctx.close();await receiver.ctx.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}

test('service and isolated browser sessions share exactly one bound invitation', {skip},async()=>fixture({},async({service,record,finished})=>{
 assert.deepEqual(await service({token:'token',requestId}),{status:'pending_review',retry:'disabled'});
 assert.equal(record.inviteCalls,1);assert.equal(record.acceptCalls,1);assert.deepEqual(finished,[[requestId,'pending_review']]);
 assert.equal((await service({token:'token',requestId})).status,'blocked');assert.equal(record.inviteCalls,1);
}));
test('mismatched visible recipient blocks remote mutation and consumes reservation', {skip},async()=>fixture({wrongRecipient:true},async({service,record})=>{
 assert.equal((await service({token:'token',requestId})).status,'uncertain');assert.equal(record.inviteCalls,0);assert.equal(record.acceptCalls,0);
 assert.equal((await service({token:'token',requestId})).status,'blocked');
}));
test('withdrawn consent after invitation blocks acceptance', {skip},async()=>fixture({withdrawAfterInvite:true},async({service,record})=>{
 assert.equal((await service({token:'token',requestId})).status,'uncertain');assert.equal(record.inviteCalls,1);assert.equal(record.acceptCalls,0);
}));
test('unconfirmed response after an actual fixture write is never repeated', {skip},async()=>fixture({uncertain:true},async({service,record})=>{
 assert.deepEqual(await service({token:'token',requestId}),{status:'uncertain',retry:'disabled'});assert.equal(record.inviteCalls,1);assert.equal(record.acceptCalls,0);
 assert.equal((await service({token:'token',requestId})).status,'blocked');assert.equal(record.inviteCalls,1);
}));
