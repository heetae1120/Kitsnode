import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler} from '../supabase/functions/kitsnode-admin-theme/handler.mjs';
import {DEFAULT_THEME, THEME_COLORS, THEME_NUMBERS,validateTheme,themeToVariables,contrastIssues} from '../supabase/functions/kitsnode-admin-theme/theme-schema.mjs';
const origin='https://kitsnode-studio-owner.junho960809.chatgpt.site';
const headers={origin,'x-github-token':'ghp_synthetic_abcdefghijklmnopqrstuvwxyz','content-type':'application/json'};
const theme={font:'system',tokens:{primary:'#112233','text-md':15,'weight-bold':800}};
const stamp='2026-11-08T10:00:00.000Z';
function setup({push=true,missing=false,badActor=false,down=false}={}) {
  const calls:{url:string,options?:RequestInit}[]=[]; let current=2;
  const handler=createHandler({projectUrl:'https://mock.test',serviceKey:'synthetic-server-only',fetchImpl:async (input:string | URL | Request,options?:RequestInit)=>{
    const url=String(input); calls.push({url,options});
    assert.equal(options?.redirect,"error", "credential-bearing server requests must reject redirects");
    if(down) throw new Error('private diagnostic must not leak');
    if(url.includes('/repos/')) return Response.json({permissions:{push}});
    if(url.endsWith('/user')) return Response.json({login:badActor?'invalid actor':'server-actor'});
    assert.equal((options?.headers as Record<string,string>).apikey,'synthetic-server-only');
    if(url.includes('kitsnode_admin_theme_state?')) return Response.json(missing?[]:[{theme,revision:current,updated_at:stamp,actor:'private-actor'}]);
    if(url.endsWith('/rpc/kitsnode_save_admin_theme')) {
      const body=JSON.parse(String(options?.body)); assert.equal(body.p_actor,'server-actor');
      if(body.p_expected_revision!==current)return Response.json({status:'conflict',revision:current});
      current++; return Response.json({status:'ok',theme:body.p_theme,revision:current,updatedAt:stamp,actor:'private-actor'});
    }
    throw new Error('unexpected endpoint');
  }});
  return {handler,calls};
}
const req=(body:unknown={expectedRevision:2,theme},customHeaders=headers)=>new Request('https://function.test/kitsnode-admin-theme',{method:'POST',headers:customHeaders,body:JSON.stringify(body)});
test('schema resolves bounded defaults and only scoped variables',()=>{
  assert.ok(validateTheme(DEFAULT_THEME)); assert.ok(validateTheme(theme));
  const vars:Record<string,string>=themeToVariables(theme); assert.equal(vars['--admin-primary'],'#112233'); assert.equal(vars['--admin-text-md'],'15px');
  assert.equal(vars['--admin-weight-bold'],'800'); assert.equal('--admin-text-caption' in vars,false);
  assert.ok(Object.keys(vars).every(k=>k.startsWith('--admin-')));
  assert.equal(Object.keys(vars).length,THEME_COLORS.length+THEME_NUMBERS.length+1);
  for(const spec of THEME_NUMBERS){
    assert.ok(validateTheme({font:'pretendard',tokens:{[spec.key]:spec.min}}));
    assert.ok(validateTheme({font:'pretendard',tokens:{[spec.key]:spec.max}}));
    assert.equal(validateTheme({font:'pretendard',tokens:{[spec.key]:spec.max+1}}),false);
  }
});
test('schema rejects injection, arbitrary fields, fonts, nonfinite and invalid weights',()=>{
  for(const value of [null,[],{}, {...theme,actor:'spoof'}, {font:'remote',tokens:{}}, {font:'system',tokens:[]},
    {font:'system',tokens:{primary:'#123456\n'}},{font:'system',tokens:{primary:'url(https://example.test)'}},
    {font:'system',tokens:{primary:'#fff'}},{font:'system',tokens:{'space-1':12}},
    {font:'system',tokens:{'text-caption':16}},{font:'system',tokens:{'text-md':NaN}},
    {font:'system',tokens:{'text-md':Infinity}},{font:'system',tokens:{'weight-bold':750}},
    JSON.parse('{"font":"system","tokens":{"__proto__":"bad"}}')]) assert.equal(validateTheme(value),false);
  assert.throws(()=>themeToVariables({font:'bad',tokens:{}}));
});
test('public GET exposes only approved snapshot with no authentication or actor',async()=>{
  const {handler,calls}=setup();const res=await handler(new Request('https://function.test/kitsnode-admin-theme'));
  assert.equal(res.status,200); assert.deepEqual(await res.json(),{theme,revision:2,updatedAt:stamp});
  assert.equal(calls.length,1); assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal(res.headers.get('access-control-allow-origin'),'*');
});
test('writes reject wrong origin, missing token and absent repository permission before storage',async()=>{
  const {handler,calls}=setup();
  assert.equal((await handler(req(undefined,{...headers,origin:'http://localhost:3000'}))).status,403);
  assert.equal((await handler(req(undefined,{...headers,'x-github-token':''}))).status,401); assert.equal(calls.length,0);
  const denied=setup({push:false});assert.equal((await denied.handler(req())).status,403);
  assert.equal(denied.calls.length,1);
});
test('save verifies server actor, strips private output and preserves revision conflicts',async()=>{
  const {handler}=setup();const result=await handler(req());assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{status:'ok',theme,revision:3,updatedAt:stamp});
  const conflict=await handler(req());assert.equal(conflict.status,409);assert.deepEqual(await conflict.json(),{error:'conflict',revision:3});
  assert.equal((await setup({badActor:true}).handler(req())).status,401);
});
test('malformed values and extra actor cannot reach database writes',async()=>{
  const {handler,calls}=setup();
  for(const body of [{expectedRevision:-1,theme},{expectedRevision:1.5,theme},{expectedRevision:Number.MAX_SAFE_INTEGER+1,theme},{expectedRevision:2,theme,actor:'spoof'},{expectedRevision:2,theme:{...theme,tokens:{unknown:'bad'}}}]) assert.equal((await handler(req(body))).status,400);
  assert.equal(calls.some(c=>c.url.includes('/rest/')),false);
  assert.equal((await handler(new Request('https://function.test/kitsnode-admin-theme',{method:'POST',headers,body:'{'}))).status,400);
  assert.equal((await handler(req({expectedRevision:2,theme,padding:'x'.repeat(17000)}))).status,413);
});
test('storage absence, errors and malformed snapshots never fake success',async()=>{
  for(const options of [{missing:true},{down:true}]) {
    const res=await setup(options).handler(new Request('https://function.test/kitsnode-admin-theme'));
    assert.equal(res.status,503);assert.equal((await res.text()).includes('diagnostic'),false);
  }
  for(const row of [{theme,revision:-1,updated_at:stamp},{theme,revision:2,updated_at:'invalid'},{theme:{font:'bad',tokens:{}},revision:2,updated_at:stamp}]){
    const handler=createHandler({projectUrl:'https://mock.test',serviceKey:'synthetic',fetchImpl:async()=>Response.json([row])});
    assert.equal((await handler(new Request('https://function.test/kitsnode-admin-theme'))).status,503);
  }
});
test('preflight restricted to exact approved admin and unknown routes fail',async()=>{
  const {handler}=setup();
  assert.equal((await handler(new Request('https://function.test',{method:'OPTIONS',headers:{origin}}))).status,204);
  assert.equal((await handler(new Request('https://function.test',{method:'OPTIONS',headers:{origin:origin+'.evil'}}))).status,403);
  assert.equal((await handler(new Request('https://function.test?resource=versions',{headers}))).status,404);
});
test('unapplied SQL contains transaction lock, service-only invoker RPC and append-only grants',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261108130036_kitsnode_admin_theme.sql',import.meta.url),'utf8');
  assert.match(sql,/for update;/); assert.match(sql,/current_row.revision <> p_expected_revision/);
  assert.match(sql,/security invoker/g);assert.doesNotMatch(sql,/security definer/i);
  assert.equal((sql.match(/enable row level security/g)||[]).length,2);
  assert.match(sql,/grant select, insert on public.kitsnode_admin_theme_versions to service_role/);
  assert.doesNotMatch(sql,/grant .* to (anon|authenticated|public);/i);
  for(const {key} of [...THEME_COLORS,...THEME_NUMBERS])assert.ok(sql.includes(`'${key}'`));
});

test('contrast and line-height save validation is separate from draft shape',async()=>{
  assert.deepEqual(contrastIssues(DEFAULT_THEME),[]);
  const unsafe={font:'system',tokens:{primary:'#ffffff'}};
  assert.equal(validateTheme(unsafe),true); assert.ok(contrastIssues(unsafe).length);
  const {handler,calls}=setup();
  const response=await handler(req({expectedRevision:2,theme:unsafe}));
  assert.equal(response.status,422); assert.equal((await response.json()).error,'invalid_contrast');
  assert.equal(calls.some(c=>c.url.includes('/rest/')),false);
  assert.ok(contrastIssues({font:'system',tokens:{'text-md':30,'caption-leading':12}}).length);
});

test('secondary controls, info surfaces and focus indicators cannot lose contrast',()=>{
  for(const tokens of [{'surface-subtle':'#191f28'},{'primary-soft':'#1b60c9'},{focus:'#ffffff'},{selected:'#191f28'}]) assert.ok(contrastIssues({font:'pretendard',tokens}).length);
  assert.deepEqual(contrastIssues(DEFAULT_THEME),[]);
});
