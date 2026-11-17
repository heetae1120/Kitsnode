import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {createNaverRankEstimate} from './naver-rank-estimate.mjs';
const key='test-key',secret='test-secret',customer='123',time=1794890000000;
function setup(fetcher){return createNaverRankEstimate({apiKey:key,secretKey:secret,customerId:customer,fetcher,now:()=>time})}
const target=(kind='keyword',device='PC')=>({kind,targetId:kind==='keyword'?'nkw-1':'nad-1',device,position:3});
test('keyword estimates separately bind customer, target, rank, device and signature',async()=>{
 let calls=0;const estimate=setup(async(url,options)=>{calls++;assert.equal(url.origin,'https://api.searchad.naver.com');assert.equal(url.pathname,'/estimate/average-position-bid/id');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.headers['X-Customer'],customer);assert.equal(options.headers['X-Signature'],createHmac('sha256',secret).update(`${time}.POST.${url.pathname}`).digest('base64'));const body=JSON.parse(options.body);assert.deepEqual(body.items,[{key:'nkw-1',position:3}]);return Response.json({device:body.device,estimate:[{nccKeywordId:'nkw-1',position:3,bid:body.device==='PC'?150:210}]})});
 for(const [device,bid] of [['PC',150],['MOBILE',210]]){const result=await estimate(target('keyword',device));assert.equal(result.bid,bid);assert.equal(result.device,device);assert.equal(result.deviceEchoed,true);assert.equal(result.execution,'disabled')};assert.equal(calls,2);
});
test('shopping responses support documented single and published items layouts',async()=>{
 for(const response of [{nccAdId:'nad-1',position:3,bid:80},{device:'PC',items:[{key:'nad-1',position:3,bid:80}]},{device:'PC',estimate:[{nccAdId:'nad-1',position:3,bid:80}]}]){const result=await setup(async(url,opts)=>{assert.equal(url.pathname,'/npla-estimate/average-position-bid/id');assert.deepEqual(JSON.parse(opts.body),{device:'PC',items:[{key:'nad-1',position:3}]});return Response.json(response)})(target('product'));assert.equal(result.bid,80);assert.equal(result.deviceEchoed,!!response.device)}
});
test('missing, foreign, wrong-rank or duplicate results never substitute another bid',async()=>{
 for(const rows of [[],[{nccKeywordId:'nkw-other',position:3,bid:100}],[{nccKeywordId:'nkw-1',position:2,bid:100}],[{nccKeywordId:'nkw-1',position:3,bid:null}]]){const r=await setup(async()=>Response.json({device:'PC',estimate:rows}))(target());assert.equal(r.ok,false);assert.equal(r.reason,'estimate_unavailable')}
 const duplicate=await setup(async()=>Response.json({device:'PC',estimate:[{nccKeywordId:'nkw-1',position:3,bid:100},{nccKeywordId:'nkw-1',position:3,bid:110}]}))(target());assert.equal(duplicate.reason,'invalid_response');
});
test('rejects mismatched or absent keyword device and conflicting shopping ids',async()=>{
 assert.equal((await setup(async()=>Response.json({device:'MOBILE',estimate:[]}))(target())).reason,'device_mismatch');
 assert.equal((await setup(async()=>Response.json({estimate:[{nccKeywordId:'nkw-1',position:3,bid:100}]}))(target())).reason,'invalid_response');
 assert.equal((await setup(async()=>Response.json({device:'PC',items:[{nccAdId:'nad-1',key:'nad-other',position:3,bid:100}]}))(target('product'))).reason,'invalid_response');
 assert.equal((await setup(async()=>Response.json({device:'PC',items:[{key:'nad-1',device:'MOBILE',position:3,bid:100}]}))(target('product'))).reason,'device_mismatch');
});
test('invalid inputs, malformed, rate-limited and network responses fail closed',async()=>{
 let calls=0;const e=setup(async()=>{calls++;throw Error('secret data')});for(const input of [{...target(),position:0},{...target('product','MOBILE'),position:6},{...target(),targetId:'nad-1'},{...target(),device:'TABLET'}])assert.equal((await e(input)).reason,'invalid_input');assert.equal(calls,0);assert.equal((await e(target())).reason,'network_error');
 for(const [response,expected] of [[new Response('{}',{status:429}),'rate_limited'],[new Response('{}',{status:403}),'access_denied'],[new Response('bad',{status:200}),'invalid_response'],[Response.json({device:'PC',estimate:[{nccKeywordId:'nkw-1',position:3,bid:101}]}),'invalid_response']])assert.equal((await setup(async()=>response)(target())).reason,expected);
});

test('accepts real-shaped product estimate of 50 KRW without adopting productId as an ad id',async()=>{
 for(const device of ['PC','MOBILE']){const result=await setup(async()=>Response.json({device,estimate:[{bid:50,productId:'91403238429',position:1,nccAdId:'nad-a001-02-000000616801563'}]}))({kind:'product',targetId:'nad-a001-02-000000616801563',device,position:1});assert.equal(result.ok,true);assert.equal(result.bid,50);assert.equal(result.device,device);}
});
test('accepts real-shaped keyword estimates with different PC and mobile bids',async()=>{
 const e=setup(async(_url,opts)=>{const {device}=JSON.parse(opts.body);return Response.json({device,estimate:[{bid:device==='PC'?15490:2410,keyword:'보조배터리',position:1,nccKeywordId:'nkw-a001-01-000008858290967'}]})});
 for(const [device,price] of [['PC',15490],['MOBILE',2410]]){const result=await e({kind:'keyword',targetId:'nkw-a001-01-000008858290967',device,position:1});assert.equal(result.bid,price);}
});

test('product ranking limits 1–4 on both devices while keyword limits remain device-specific',async()=>{
 let calls=0;const e=setup(async(_url,opts)=>{calls++;const {device,items:[{key,position}]}=JSON.parse(opts.body);return Response.json({device,estimate:[{nccAdId:key,position,bid:50}]})});
 for(const device of ['PC','MOBILE']){assert.equal((await e({kind:'product',targetId:'nad-1',device,position:4})).ok,true);assert.equal((await e({kind:'product',targetId:'nad-1',device,position:5})).reason,'invalid_input')}
 assert.equal(calls,2);
});
