// Test fixture only. Owns its loopback mock server; it cannot accept a host,
// credentials, account or fetch implementation from callers. Never import
// this fixture into an application route or scheduler. Its process-local
// reservation only models one server lifetime and is not a durable store.
import http from 'node:http';
import {createNaverIndividualBidAdapter} from '../src/naver-individual-bid-adapter.mjs';
import {createIndividualBidManualTestService} from '../src/individual-bid-manual-test-service.mjs';
import {readLimitedJson} from '../src/limited-json.mjs';

const allowedFields=['requestId','kind','targetId','groupId','desiredBid','expectedBid','expectedUseGroupBid','allowGroupConversion'];
export async function createIndividualBidTestApi({enabled=false,scenario='normal'}={}) {
 if(enabled!==true)throw Error('test_api_disabled');
 if(!['normal','ignore_write','lost_write_response','failed_verification'].includes(scenario))throw Error('invalid_scenario');
 const rows={product:{nccAdId:'nad-test',nccAdgroupId:'grp-test',customerId:123,type:'SHOPPING_PRODUCT_AD',adAttr:{bidAmt:null,useGroupBidAmt:true}},keyword:{nccKeywordId:'nkw-test',nccAdgroupId:'grp-test',customerId:123,bidAmt:null,useGroupBidAmt:true}};
 const calls=[],reserved=new Set(),audits=new Map();let puts=0;
 const server=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const url=new URL(req.url,'http://127.0.0.1');calls.push({method:req.method,path:url.pathname,query:url.search});
  res.setHeader('Content-Type','application/json');
  if(req.method==='GET'){
   if(scenario==='failed_verification'&&puts){res.writeHead(503);res.end('{}');return}
   if(url.pathname==='/ncc/ads/nad-test'){res.end(JSON.stringify(rows.product));return}
   if(url.pathname==='/ncc/keywords/nkw-test'){res.end(JSON.stringify(rows.keyword));return}
  }
  if(req.method==='PUT'){
   puts++;let parsed;try{parsed=JSON.parse(body)}catch{res.writeHead(400);res.end('{}');return}
   if(scenario!=='ignore_write'){
    if(url.pathname==='/ncc/ads/nad-test')rows.product.adAttr=parsed.adAttr;
    else if(url.pathname==='/ncc/keywords'){rows.keyword.bidAmt=parsed[0].bidAmt;rows.keyword.useGroupBidAmt=parsed[0].useGroupBidAmt}
    else {res.writeHead(404);res.end('{}');return}
   }
   if(scenario==='lost_write_response'){req.socket.destroy();return}
   res.end('{}');return;
  }
  res.writeHead(404);res.end('{}');
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const port=server.address().port;
 const adapter=createNaverIndividualBidAdapter({apiKey:'mock-key',secretKey:'mock-secret',customerId:'123',writeEnabled:true,fetcher:(url,options)=>{
  if(url.protocol!=='https:'||url.hostname!=='api.searchad.naver.com'||url.port||url.username||url.password)throw Error('unexpected_provider');
  return fetch(new URL(url.pathname+url.search,`http://127.0.0.1:${port}`),{...options,redirect:'error'});
 }});
 return Object.freeze({calls,async close(){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))},async handle(request){
  const respond=(value,status)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!=='/test/individual-bid'||url.search)return respond({error:'not_found'},404);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??''))return respond({error:'invalid_content_type'},415);
  let input;try{input=await readLimitedJson(request,8192)}catch{return respond({error:'invalid_body'},400)}
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowedFields.includes(k)))return respond({error:'invalid_input'},400);
  if(!['product','keyword'].includes(input.kind)||input.groupId!=='grp-test'||input.targetId!==(input.kind==='product'?'nad-test':'nkw-test'))return respond({error:'invalid_target'},400);
  const raw=rows[input.kind],attr=input.kind==='product'?raw.adAttr:raw;
  if(input.expectedBid!==attr.bidAmt||input.expectedUseGroupBid!==attr.useGroupBidAmt)return respond({status:'blocked',reason:'state_changed',retry:'disabled'},409);
  const userId='11111111-1111-4111-8111-111111111111',connectionId='22222222-2222-4222-8222-222222222222',ruleId='33333333-3333-4333-8333-333333333333',clock=Date.now();
  const service=createIndividualBidManualTestService({enabled:true,now:()=>clock,verifyUser:async()=>({id:userId}),loadRule:async()=>({id:ruleId,userId,connectionId,version:1,kind:input.kind,groupId:input.groupId,targetId:input.targetId,minBid:input.kind==='product'?50:70,maxBid:200,maxChange:100}),loadBinding:async()=>({id:connectionId,userId,status:'read_connected',revision:1,customerId:'123'}),loadApproval:async()=>({userId,connectionId,connectionRevision:1,writeAllowed:true,expiresAt:clock+60000}),loadSnapshot:async()=>({kind:input.kind,customerId:'123',groupId:input.groupId,targetId:input.targetId,bid:attr.bidAmt,useGroupBid:attr.useGroupBidAmt,groupBid:70,observedAt:clock}),reserve:async record=>{if(reserved.has(record.requestId))return false;reserved.add(record.requestId);return true},finish:async record=>{audits.set(record.requestId,record.outcome);return true},adapterForBinding:async()=>adapter});
  const result=await service.execute({token:'synthetic-test-user',requestId:input.requestId,ruleId,desiredBid:input.desiredBid,confirm:true,allowGroupConversion:input.allowGroupConversion??false});
  return respond(result,result.status==='blocked'?409:result.status==='observed_applied'?200:502);
 }});
}
