import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {createNaverIndividualBidAdapter} from './naver-individual-bid-adapter.mjs';
const groupId='grp-test',customerId='123',key='test-key',secret='test-secret';
function scenario({kind='product',enabled=true,ignore=false,timeout=false,foreign=false,failVerification=false,inherited=true}={}) {
 const targetId=kind==='product'?'nad-test':'nkw-test';let mode=inherited,value=inherited?null:70,calls=[],putCount=0;
 const fetcher=async(url,opts)=>{
  calls.push({url:new URL(url),opts});const t=opts.headers['X-Timestamp'];assert.equal(opts.headers['X-Signature'],createHmac('sha256',secret).update(`${t}.${opts.method}.${url.pathname}`).digest('base64'));assert.equal(opts.headers['X-Customer'],customerId);
  if(opts.method==='GET'){
   if(failVerification&&putCount)return new Response('error',{status:503});
   const base={nccAdgroupId:groupId,customerId:foreign?456:123};const data=kind==='product'?{...base,nccAdId:targetId,type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:value,useGroupBidAmt:mode}}:{...base,nccKeywordId:targetId,bidAmt:value,useGroupBidAmt:mode};return Response.json(data);
  }
  putCount++;const input=JSON.parse(opts.body);if(!ignore){value=kind==='product'?input.adAttr.bidAmt:input[0].bidAmt;mode=false}if(timeout)throw Error('lost response');return Response.json({ok:true});
 };
 const adapter=createNaverIndividualBidAdapter({apiKey:key,secretKey:secret,customerId,writeEnabled:enabled,fetcher,now:()=>1000});
 return {adapter,calls,getPutCount:()=>putCount,targetId};
}
const args=(x,kind='product')=>({kind,targetId:x.targetId,groupId,desiredBid:80,expectedBid:null,expectedUseGroupBid:true,allowGroupConversion:true});
test('write is disabled by default and conversion requires explicit consent',async()=>{const a=scenario({enabled:false});assert.equal((await a.adapter.changeAndVerify(args(a))).reason,'write_disabled');assert.equal(a.calls.length,0);const b=scenario();assert.equal((await b.adapter.changeAndVerify({...args(b),allowGroupConversion:false})).reason,'conversion_not_authorized');assert.equal(b.calls.length,0)});
test('product conversion sends adAttr and verifies fresh server state',async()=>{const x=scenario();const r=await x.adapter.changeAndVerify(args(x));assert.deepEqual(r,{status:'observed_applied',retry:'disabled',observedBid:80,observedUseGroupBid:false});assert.deepEqual(x.calls.map(c=>c.opts.method),['GET','PUT','GET']);const req=x.calls[1];assert.equal(req.url.pathname,'/ncc/ads/nad-test');assert.equal(req.url.searchParams.get('fields'),'adAttr');assert.deepEqual(JSON.parse(req.opts.body),{nccAdId:'nad-test',type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:80,useGroupBidAmt:false}})});
test('keyword sends one-element bidAmt array and verifies actual change',async()=>{const x=scenario({kind:'keyword'});const r=await x.adapter.changeAndVerify(args(x,'keyword'));assert.equal(r.status,'observed_applied');const req=x.calls[1];assert.equal(req.url.pathname,'/ncc/keywords');assert.equal(req.url.searchParams.get('fields'),'bidAmt');const body=JSON.parse(req.opts.body);assert.equal(body.length,1);assert.equal(body[0].nccKeywordId,'nkw-test');assert.equal(body[0].useGroupBidAmt,false);assert.equal(body[0].bidAmt,80)});
test('success response without actual change returns mismatch, not success',async()=>{const x=scenario({ignore:true,inherited:false});const r=await x.adapter.changeAndVerify({...args(x),expectedBid:70,expectedUseGroupBid:false});assert.equal(r.status,'mismatch');assert.equal(r.retry,'disabled');assert.equal(x.getPutCount(),1)});
test('timeout never becomes success even when later read matches; no retry',async()=>{const x=scenario({timeout:true});const r=await x.adapter.changeAndVerify(args(x));assert.equal(r.status,'unconfirmed');assert.equal(r.observedBid,80);assert.equal(r.retry,'disabled');assert.equal(x.getPutCount(),1)});
test('wrong account, changed input, failed re-read and invalid values fail closed',async()=>{const x=scenario({foreign:true});assert.equal((await x.adapter.changeAndVerify(args(x))).reason,'read_unavailable');assert.equal(x.getPutCount(),0);const y=scenario();assert.equal((await y.adapter.changeAndVerify({...args(y),expectedUseGroupBid:false})).reason,'state_changed');assert.equal(y.getPutCount(),0);const z=scenario({failVerification:true});assert.equal((await z.adapter.changeAndVerify(args(z))).status,'unconfirmed');assert.equal((await scenario().adapter.changeAndVerify({...args(z),desiredBid:55})).reason,'invalid_input')});
