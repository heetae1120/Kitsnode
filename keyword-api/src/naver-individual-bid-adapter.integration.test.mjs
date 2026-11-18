import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {createNaverIndividualBidAdapter} from './naver-individual-bid-adapter.mjs';

test('mock HTTP provider: product and keyword writes require provider re-read',async(t)=>{
 const rows={product:{nccAdId:'nad-test',nccAdgroupId:'grp-test',customerId:123,type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:null,useGroupBidAmt:true}},keyword:{nccKeywordId:'nkw-test',nccAdgroupId:'grp-test',customerId:123,bidAmt:null,useGroupBidAmt:true}};
 let requests=[];const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const u=new URL(req.url,'http://localhost');requests.push([req.method,u.pathname,u.search]);res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify(u.pathname==='/ncc/ads/nad-test'?rows.product:rows.keyword));return}const value=JSON.parse(body);if(u.pathname==='/ncc/ads/nad-test')rows.product.adAttr=value.adAttr;else if(u.pathname==='/ncc/keywords'){rows.keyword.bidAmt=value[0].bidAmt;rows.keyword.useGroupBidAmt=value[0].useGroupBidAmt}res.end('{}')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const port=server.address().port;const adapter=createNaverIndividualBidAdapter({apiKey:'test',secretKey:'secret',customerId:'123',writeEnabled:true,fetcher:(url,opts)=>{const local=new URL(url.pathname+url.search,`http://127.0.0.1:${port}`);return fetch(local,opts)}});
 for(const [kind,targetId] of [['product','nad-test'],['keyword','nkw-test']]){const result=await adapter.changeAndVerify({kind,targetId,groupId:'grp-test',desiredBid:80,expectedBid:null,expectedUseGroupBid:true,allowGroupConversion:true});assert.equal(result.status,'observed_applied');assert.equal(result.retry,'disabled')}
 assert.deepEqual(requests.map(r=>r[0]),['GET','PUT','GET','GET','PUT','GET']);assert.equal(rows.product.adAttr.bidAmt,80);assert.equal(rows.keyword.bidAmt,80);
});
