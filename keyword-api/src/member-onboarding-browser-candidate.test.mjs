import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {Readable} from 'node:stream';
import {createMemberOnboardingHttpCandidate} from './member-onboarding-http-candidate.mjs';
const require=createRequire('/Users/junho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const {chromium}=require('playwright');
async function start(handler){const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server;}
const origin=s=>`http://127.0.0.1:${s.address().port}`;
const close=s=>new Promise((resolve,reject)=>s.close(error=>error?reject(error):resolve()));
test('browser CORS permits intended site and rejects another site across real origins',async()=>{
 const site=await start((_q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><title>test</title>')});
 const attacker=await start((_q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><title>test</title>')});
 let count=0,options=0;const service={async complete(value){count++;return {ok:true,code:'profile_completed',auth:value.token==='test-token'}}};
 const handler=createMemberOnboardingHttpCandidate({service,trustedOrigin:origin(site),clientKeyFromRuntime:async()=> 'trusted'});
 const api=await start(async(q,r)=>{try {if(q.method==='OPTIONS')options++;const init={method:q.method,headers:q.headers};if(!['GET','HEAD'].includes(q.method)&&q.method!=='OPTIONS'){init.body=Readable.toWeb(q);init.duplex='half';}const response=await handler(new Request('http://127.0.0.1/api',init),'complete');r.writeHead(response.status,Object.fromEntries(response.headers));r.end(Buffer.from(await response.arrayBuffer()));}catch{r.writeHead(500);r.end();}});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const page=await browser.newPage();await page.goto(origin(site));
  const request=endpoint=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:'{}'}).then(r=>r.json());
  const success=await page.evaluate(request,`${origin(api)}/api`);assert.deepEqual(success,{ok:true,code:'profile_completed',auth:true});assert.ok(options>0);assert.equal(count,1);
  await page.goto(origin(attacker));const blocked=await page.evaluate(async endpoint=>{try{await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer test-token'},body:'{}'});return false;}catch{return true;}},`${origin(api)}/api`);
  assert.equal(blocked,true);assert.equal(count,1);
 } finally {await browser.close();await close(api);await close(attacker);await close(site);}
});
