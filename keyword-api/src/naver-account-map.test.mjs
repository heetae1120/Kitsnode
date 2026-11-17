import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createAccountResolver} from './naver-account-map.mjs';
const base={apiKey:'test-key',secretKey:'test-secret',principalCustomerId:'101',now:()=>100};
const row={adAccountNo:2647636,roleName:'MASTER',adAccount:{masterCustomerId:4563552}};
test('resolves Naver Ads account number to distinct SA customer ID using principal credentials',async()=>{
 const seen=[];const resolve=createAccountResolver({...base,fetcher:async(u,o)=>{seen.push([u,o]);return Response.json({content:[row],last:true});}});
 assert.deepEqual(await resolve('2647636'),{ok:true,adAccountId:'2647636',customerId:'4563552',role:'MASTER'});
 assert.equal(seen[0][0].pathname,'/ad-accounts');assert.equal(seen[0][1].headers['X-Customer'],'101');
 assert.equal(seen[0][1].headers['X-Signature'],createHmac('sha256','test-secret').update('100.GET./ad-accounts').digest('base64'));
});
test('paginates and never reports absent when response is incomplete',async()=>{
 let count=0;const resolve=createAccountResolver({...base,fetcher:async()=>Response.json(++count===1?{content:[],last:false}:{content:[row],last:true})});
 assert.equal((await resolve('2647636')).customerId,'4563552');assert.equal(count,2);
 const bounded=createAccountResolver({...base,fetcher:async()=>Response.json({content:[],last:false})});
 assert.equal((await bounded('2647636')).code,'pagination_limit');
});
test('rejects malformed, inaccessible, or duplicate entries',async()=>{
 for (const [body,code] of [[{content:[],last:true},'not_accessible'],[{content:[row,row],last:true},'ambiguous_response'],[{content:[{...row,adAccount:{}}],last:true},'invalid_response'],[{content:[]},'invalid_response']]) {
 const resolve=createAccountResolver({...base,fetcher:async()=>Response.json(body)});assert.equal((await resolve('2647636')).code,code);
 }
 const resolve=createAccountResolver({...base,fetcher:async()=>new Response('',{status:403})});assert.equal((await resolve('2647636')).code,'access_denied');assert.equal((await resolve('2647636/evil')).code,'invalid_target');
});
