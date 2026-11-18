import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createIndividualBidTestApi} from './individual-bid-test-api.mjs';

async function start(t,scenario='normal'){
 const api=await createIndividualBidTestApi({enabled:true,scenario});
 const server=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const result=await api.handle(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await api.close()});
 return {api,url:`http://127.0.0.1:${server.address().port}/test/individual-bid`};
}
const args=(kind)=>({requestId:'44444444-4444-4444-8444-444444444444',kind,targetId:kind==='product'?'nad-test':'nkw-test',groupId:'grp-test',desiredBid:80,expectedBid:null,expectedUseGroupBid:true,allowGroupConversion:true});
const post=(url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('test API stays disabled unless explicitly enabled; rejects unknown scenario',async()=>{
 await assert.rejects(()=>createIndividualBidTestApi(),/test_api_disabled/);
 await assert.rejects(()=>createIndividualBidTestApi({enabled:true,scenario:'external'}),/invalid_scenario/);
});
for(const kind of ['product','keyword'])test(`${kind}: HTTP API uses mock provider GET → PUT → GET and confirms result`,async t=>{
 const {api,url}=await start(t);const r=await post(url,args(kind));assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{status:'observed_applied',retry:'disabled',observedBid:80,observedUseGroupBid:false});
 assert.deepEqual(api.calls.map(x=>x.method),['GET','PUT','GET']);
 assert.equal(api.calls[1].path,kind==='product'?'/ncc/ads/nad-test':'/ncc/keywords');
});
test('unconfirmed outcomes do not retry and are not reported as success',async t=>{
 for(const [scenario,expected] of [['ignore_write','unconfirmed'],['lost_write_response','unconfirmed'],['failed_verification','unconfirmed']]){
  const {api,url}=await start(t,scenario);const r=await post(url,args('product'));assert.equal(r.status,502);const result=await r.json();assert.equal(result.status,expected);assert.equal(result.retry,'disabled');assert.equal(api.calls.filter(x=>x.method==='PUT').length,1);
 }
});
test('invalid and unauthorized conversion requests never reach a write',async t=>{
 const {api,url}=await start(t);
 for(const value of [{...args('product'),allowGroupConversion:false},{...args('keyword'),desiredBid:55},{...args('product'),customerId:'456'}]){const r=await post(url,value);assert.ok([400,409].includes(r.status));}
 assert.equal(api.calls.filter(x=>x.method==='PUT').length,0);
});
test('repeated or concurrent HTTP requests with the same ID cause one mock PUT',async t=>{
 const {api,url}=await start(t,'ignore_write'),body=args('product');
 const responses=await Promise.all([post(url,body),post(url,body)]),results=await Promise.all(responses.map(x=>x.json()));
 assert.equal(api.calls.filter(x=>x.method==='PUT').length,1);
 assert.equal(results.filter(x=>x.status==='unconfirmed').length,1);assert.equal(results.filter(x=>x.reason==='reservation_rejected').length,1);
 const repeat=await post(url,body);assert.equal((await repeat.json()).reason,'reservation_rejected');assert.equal(api.calls.filter(x=>x.method==='PUT').length,1);
});
