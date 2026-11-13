import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAnalyticsHandler, parseAnalyticsOrigins, validateAnalyticsEvent } from '../supabase/functions/kitsnode-analytics/handler.mjs';
const front = 'https://visitor.example'; const admin = 'https://admin.example';
const token = 'synthetic_github_token_123456789';
const event = () => ({version:1,viewId:'491b857a-7641-4cef-8a22-28d383a498c2',sequence:1,page:'/tools/survey/',visibleMs:15000,engagedMs:14000,reason:'heartbeat',survey:{step:'brandVision',lastField:'brandVision',lastInputAgoMs:2000,completed:false}});
const report = {days:7,generatedAt:'2026-11-07T00:00:00Z',abandonmentAfterMinutes:30,pages:[],survey:{started:0,completed:0,incomplete:0,pending:0,dropoffs:[]}};
function harness(options:Record<string,unknown> = {}) {
  const calls:{url:string;body:unknown}[]=[];
  const handler=createAnalyticsHandler({projectUrl:'https://storage.example',serviceKey:'synthetic-service-key',ingestEnabled:true,frontendOrigins:[front],adminOrigins:[admin],fetchImpl:async (url:unknown, init?:RequestInit) => {
    calls.push({url:String(url),body:init?.body?JSON.parse(String(init.body)):null});
    if(String(url).startsWith('https://api.github.com/')) return Response.json({permissions:{push:true}});
    if(String(url).endsWith('kitsnode_main_session_report')) return Response.json({landing:'main',rows:[]});
    return Response.json(String(url).endsWith('_report')?report:{status:'ok'});
  },...options});
  return {handler,calls};
}
function collect(body:unknown=event(),origin=front,extra:Record<string,string>={}) {return new Request('https://endpoint.example/analytics',{method:'POST',headers:{origin,'content-type':'text/plain',...extra},body:JSON.stringify(body)});}
function getReport(origin=admin,auth=token,query='days=7') {return new Request(`https://endpoint.example/analytics?resource=report&${query}`,{headers:{origin,'x-github-token':auth}});}

test('analytics contract permits only bounded metadata and rejects PII-bearing extras',()=>{
  assert.equal(validateAnalyticsEvent(event()),true);
  for (const extra of [{answer:'private'},{email:'x'},{url:'/tools/?phone=1'},{referrer:'x'},{sessionId:'x'}]) assert.equal(validateAnalyticsEvent({...event(),...extra}),false);
  for (const patch of [{page:'/tools/survey/?email=x'},{page:'/tools/admin/'},{sequence:0},{visibleMs:86400001},{engagedMs:16000},{viewId:'customer-id'},{reason:'closed'}]) assert.equal(validateAnalyticsEvent({...event(),...patch}),false);
  assert.equal(validateAnalyticsEvent({...event(),survey:{...event().survey,value:'private'}}),false);
  assert.equal(validateAnalyticsEvent({...event(),survey:{...event().survey,lastField:'typed free text'}}),false);
  assert.equal(validateAnalyticsEvent({...event(),survey:{...event().survey,lastField:null}}),false);
  assert.equal(validateAnalyticsEvent({...event(),reason:'complete'}),false);
  assert.equal(validateAnalyticsEvent({...event(),reason:'complete',survey:{...event().survey,step:'contact',completed:true}}),true);
  assert.equal(validateAnalyticsEvent({...event(),page:'/tools/',survey:null}),true);
  assert.equal(validateAnalyticsEvent({...event(),page:'/tools/',reason:'complete',survey:null}),false);
});
test('origin config allows exact HTTPS origins only',()=>{
  assert.deepEqual(parseAnalyticsOrigins('https://site.example, *, http://localhost:3000,https://site.example/,https://user:pass@site.example,https://site.example'),['https://site.example']);
});
test('collection is fail-closed without enable flag or allowed origin and never reaches storage',async()=>{
  const disabled=harness({ingestEnabled:false}); assert.equal((await disabled.handler(collect())).status,503);assert.equal(disabled.calls.length,0);
  const h=harness();for(const origin of ['',admin,'https://attacker.example']) assert.equal((await h.handler(collect(event(),origin))).status,403);
  assert.equal(h.calls.length,0);
});
test('valid snapshots only reach private RPC, not headers, token, IP, query or referrer',async()=>{
  const h=harness();const response=await h.handler(collect(event(),front,{'cookie':'secret=x','x-forwarded-for':'192.0.2.1','referer':'https://site.example/?private=x'}));
  assert.equal(response.status,202);assert.equal(response.headers.get('access-control-allow-origin'),front);
  assert.deepEqual(h.calls,[{url:'https://storage.example/rest/v1/rpc/kitsnode_record_analytics',body:{p_origin:front,p_event:event()}}]);
});
test('reject malformed, oversize streaming, MIME and unknown data before RPC',async()=>{
  const h=harness();assert.equal((await h.handler(collect({...event(),typedText:'private'}))).status,400);
  assert.equal((await h.handler(collect('x'.repeat(3000)))).status,413);
  assert.equal((await h.handler(collect(event(),front,{'content-type':'application/octet-stream'}))).status,415);
  const bad=new Request('https://endpoint.example/analytics',{method:'POST',headers:{origin:front,'content-type':'text/plain'},body:'{'});
  assert.equal((await h.handler(bad)).status,400);assert.equal(h.calls.length,0);
});
test('report requires admin origin, token and independently verified repository push permission',async()=>{
  const h=harness();assert.equal((await h.handler(getReport(front))).status,403);assert.equal((await h.handler(getReport(admin,''))).status,401);assert.equal(h.calls.length,0);
  const denied=harness({fetchImpl:async()=>Response.json({permissions:{push:false}})});assert.equal((await denied.handler(getReport())).status,403);
  const res=await h.handler(getReport());assert.equal(res.status,200);assert.deepEqual(await res.json(),{...report,sessions:{landing:'main',rows:[]}});assert.equal(h.calls.length,3);
  assert.equal((await h.handler(getReport(admin,token,'days=365'))).status,400);
});
test('global SQL cap is surfaced and errors never disclose secrets',async()=>{
  const h=harness({fetchImpl:async()=>Response.json({status:'rate_limited'})});assert.equal((await h.handler(collect())).status,429);
  const failed=harness({fetchImpl:async()=>{throw Error('synthetic-service-key private response');}});const res=await failed.handler(collect());assert.equal(res.status,503);assert.equal((await res.text()).includes('private'),false);
});
test('duplicate beacons are accepted without retrying and report rate limit bounds GitHub requests',async()=>{
  const h=harness({fetchImpl:async()=>Response.json({status:'duplicate'})});assert.equal((await h.handler(collect())).status,202);
  const reports=harness({now:()=>0});for(let i=0;i<30;i++)await reports.handler(getReport());assert.equal((await reports.handler(getReport())).status,429);assert.equal(reports.calls.length,90);
});
test('migration keeps raw data private, uses invoker and atomic monotonic snapshots, retention explicit',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261107145249_kitsnode_private_analytics.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/enable row level security/g)||[]).length,2);assert.equal(sql.includes('security definer'),false);
  for(const text of ['from public, anon, authenticated','pg_advisory_xact_lock','event_sequence <= current_row.sequence','current_row.completed or','r.requests < 6000',"interval '90 days'","interval '30 minutes'"]) assert.ok(sql.includes(text),text);
});

test('v2 timing exact shape accepts unknown/zero, rejects values outside page and survey totals', () => {
  const timing={elapsedMs:20_000,visibleMs:15_000,engagedMs:14_000};
  const v2={...event(),version:2,survey:{...event().survey,timing}};
  assert.equal(validateAnalyticsEvent(v2),true);
  assert.equal(validateAnalyticsEvent({...v2,survey:{...v2.survey,timing:null}}),true);
  assert.equal(validateAnalyticsEvent({...v2,survey:{...v2.survey,timing:{elapsedMs:0,visibleMs:0,engagedMs:0}}}),true);
  for(const patch of [{elapsedMs:-1},{elapsedMs:86400001},{visibleMs:16000},{elapsedMs:14000},{engagedMs:15000},{engagedMs:1.5},{answer:'secret'}])assert.equal(validateAnalyticsEvent({...v2,survey:{...v2.survey,timing:{...timing,...patch}}}),false);
  assert.equal(validateAnalyticsEvent({...v2,survey:event().survey}),false);
  assert.equal(validateAnalyticsEvent({...event(),survey:v2.survey}),false);
  assert.equal(validateAnalyticsEvent({...v2,version:3}),false);
  assert.equal(validateAnalyticsEvent({...v2,page:'/tools/',survey:null}),true);
});
test('v2 validated timing reaches the same private RPC without adding answer fields', async () => {
  const h=harness();const v2={...event(),version:2,survey:{...event().survey,timing:{elapsedMs:20000,visibleMs:15000,engagedMs:14000}}};
  assert.equal((await h.handler(collect(v2))).status,202);
  assert.deepEqual(h.calls[0].body,{p_origin:front,p_event:v2});
});

 test('main sessions reject extra private fields and require allowed origin',async()=>{
  const h=harness();const session={version:1,sessionId:'491b857a-7641-4cef-8a22-28d383a498c2',landing:'main',attribution:{source:'instagram',medium:'social',campaign:'none',basis:'referrer'}};
  const req=(payload:unknown,origin=front)=>new Request('https://endpoint.example/analytics?resource=session',{method:'POST',headers:{origin,'content-type':'text/plain'},body:JSON.stringify(payload)});
  assert.equal((await h.handler(req(session))).status,202);
  assert.equal((await h.handler(req({...session,email:'private'}))).status,400);
  assert.equal((await h.handler(req({...session,attribution:{...session.attribution,source:'https://example.com'}}))).status,400);
  assert.equal((await h.handler(req(session,'https://bad.example'))).status,403);
  assert.equal(h.calls.length,1);
 });
