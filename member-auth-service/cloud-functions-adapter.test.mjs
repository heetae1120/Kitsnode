import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudFunctionsAdapter} from './cloud-functions-adapter.mjs';

const origin='https://auth.example.test';
const event=(more={})=>({__ow_method:'get',__ow_path:'/api/member/session',__ow_query:'',__ow_headers:{origin:'https://site.example.test'},...more});
test('adapts request and response without trusting forwarded host',async()=>{
  const action=createCloudFunctionsAdapter({origin,handle:async request=>{
    assert.equal(request.url,origin+'/api/auth/sign-in/email?x=1');
    assert.equal(request.headers.get('x-forwarded-host'),null);
    assert.deepEqual(await request.json(),{email:'a@example.test'});
    return new Response('ok',{status:201,headers:{'set-cookie':'session=abc; HttpOnly; Secure','cache-control':'no-store'}});
  }});
  const response=await action(event({__ow_method:'post',__ow_path:'/api/auth/sign-in/email',__ow_query:'x=1',__ow_headers:{'content-type':'application/json','x-forwarded-host':'evil.test'},__ow_body:Buffer.from(JSON.stringify({email:'a@example.test'})).toString('base64')}));
  assert.equal(response.statusCode,201); assert.match(response.headers['Set-Cookie'],/^session=/); assert.equal(response.body,'ok');
});
test('preserves separate cookies and rejects untrusted event paths',async()=>{
  let calls=0; const action=createCloudFunctionsAdapter({origin,handle:async()=>{calls++; const h=new Headers();h.append('set-cookie','a=1');h.append('set-cookie','b=2');return new Response('ok',{headers:h});}});
  assert.equal((await action(event({__ow_path:'//evil.test/x'}))).statusCode,400);
  assert.equal((await action(event({__ow_path:'/api/../x'}))).statusCode,400);
  const result=await action(event()); assert.equal(result.statusCode,200);assert.deepEqual(result.headers['Set-Cookie'],['a=1','b=2']);assert.equal(calls,1);
});
test('rejects invalid input and does not expose handler errors',async()=>{
  const action=createCloudFunctionsAdapter({origin,handle:async()=>{throw new Error('secret');}});
  assert.equal((await action(event({__ow_method:'post',__ow_body:'not base64'}))).statusCode,400);
  const result=await action(event());assert.equal(result.statusCode,503);assert.doesNotMatch(result.body,/secret/);
  assert.throws(()=>createCloudFunctionsAdapter({origin:'http://example.test',handle:()=>{}}));
});

test('adapter reaches the existing member app and preserves its origin checks',async()=>{
  const {PGlite}=await import('@electric-sql/pglite');
  const {readFile}=await import('node:fs/promises');
  const {createPostgresMemberApp}=await import('./app.mjs');
  const db=new PGlite();
  try {
    await db.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql',import.meta.url),'utf8'));
    const auth={handler:async()=>new Response(null,{status:204}),api:{getSession:async()=>null}};
    const app=await createPostgresMemberApp({auth,pool:db,terms:{version:'fixture',text:'Synthetic terms'},allowedOrigins:['https://site.example.test']});
    const action=createCloudFunctionsAdapter({origin,handle:app});
    const response=await action(event());
    assert.equal(response.statusCode,200); assert.equal(JSON.parse(response.body).authenticated,false);
    assert.equal(response.headers['access-control-allow-origin'],'https://site.example.test');
    assert.equal((await action(event({__ow_headers:{origin:'https://evil.example.test'}}))).statusCode,403);
  } finally {await db.close();}
});
