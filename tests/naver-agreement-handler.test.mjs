import test from 'node:test';
import assert from 'node:assert/strict';
import {createNaverAgreementHandler} from '../supabase/functions/_shared/naver-agreement-handler.mjs';

const config={origin:'https://example.test',clientId:'app',requiredTermCodes:['terms','privacy'],termsVersion:'v1',privacyVersion:'v1'};
const agreement={result:'success',agreementInfos:['terms','privacy'].map(termCode=>({termCode,clientId:'app',agreeDate:'10:30:00.000 AM 11/23/2026'}))};
const request=(body,options={})=>new Request('https://edge.test/agreement',{method:'POST',headers:{origin:'https://example.test',authorization:'Bearer session-token','content-type':'application/json',...options},body:JSON.stringify(body)});
function setup({subject='naver-id',id='naver-id',store=true}={}){
  const writes=[];const calls=[];
  const handler=createNaverAgreementHandler({...config,authenticate:async token=>token==='session-token'?{userId:'user',sessionId:'session',naverSubject:subject}:null,recordEvidence:async evidence=>{writes.push(evidence);return store},fetchImpl:async (url,options)=>{calls.push(url);assert.equal(options.redirect,'error');return Response.json(url.endsWith('/me')?{resultcode:'00',response:{id}}:agreement)}});
  return {handler,writes,calls};
}
test('verified identity and required terms record evidence scoped to authenticated user and session',async()=>{
  const {handler,writes}=setup();const result=await handler(request({providerToken:'naver-token'}));assert.equal(result.status,200);assert.deepEqual(await result.json(),{ok:true});assert.equal(writes.length,1);assert.equal(writes[0].userId,'user');assert.equal(writes[0].sessionId,'session');assert.equal(writes[0].termsVersion,'v1');assert.ok(!JSON.stringify(writes).includes('naver-token'));
});
test('untrusted identity fields and mismatched accounts never record consent',async()=>{
  let x=setup();assert.equal((await x.handler(request({providerToken:'naver-token',subject:'other'}))).status,400);assert.equal(x.writes.length,0);
  x=setup({id:'different'});assert.equal((await x.handler(request({providerToken:'naver-token'}))).status,403);assert.equal(x.writes.length,0);assert.equal(x.calls.length,1);
});
test('session, origin, bounds, and persistence failure are fail-closed',async()=>{
  let x=setup();assert.equal((await x.handler(request({providerToken:'n'},{authorization:'Bearer bad'}))).status,401);assert.equal((await x.handler(request({providerToken:'n'},{origin:'https://other.test'}))).status,403);assert.equal((await x.handler(request({providerToken:'n'.repeat(12000)}))).status,400);assert.equal(x.writes.length,0);
  x=setup({store:false});assert.equal((await x.handler(request({providerToken:'naver-token'}))).status,503);
});
