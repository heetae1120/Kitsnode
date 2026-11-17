import test from 'node:test';import assert from 'node:assert/strict';
import {createConnectionHttp,createSupabaseSessionVerifier} from './connection-http.mjs';
const user='a0000000-0000-4000-8000-000000000001', other='a0000000-0000-4000-8000-000000000002',rid='a0000000-0000-4000-8000-000000000003';
test('verifies bearer through Supabase getUser, rejects anonymous and malformed users',async()=>{
 let calls=0; const verify=createSupabaseSessionVerifier({auth:{getUser:async token=>{calls++;return token==='valid'?{data:{user:{id:user,aud:'authenticated'}}}:{data:{user:{id:user,is_anonymous:true,aud:'authenticated'}}};}}});
 assert.deepEqual(await verify('valid'),{id:user});assert.equal(await verify('bad'),null);assert.equal(await verify('bad token'),null);assert.equal(calls,2);
});
function fixture(overrides={}) {
 const called=[];const service={request:async(t,id)=>{called.push([t,id]);return {ok:true}},disconnect:async()=>({ok:true})};
 const deps={allowedOrigins:['https://example.test'],verifySession:async t=>t==='valid'?{id:user}:null,memberAllowed:async()=>true,allowRequest:async()=>true,service,listOwned:async id=>[{userId:id,requestId:rid,adAccountId:'2647636',status:'pending_review',customerId:'secret'}],...overrides};
 return {handler:createConnectionHttp(deps),called};
}
const req=(method,path='/api/ad-connections',body,extra={})=>new Request('https://api.test'+path,{method,headers:{origin:'https://example.test',authorization:'Bearer valid',...(body?{'content-type':'application/json'}:{}),...extra},...(body?{body}:{} )});
test('allows only authorized principal to request a pending connection with exact fields',async()=>{
 const {handler,called}=fixture();const ok=await handler(req('POST',undefined,JSON.stringify({adAccountId:'2647636'})));assert.equal(ok.status,201);assert.deepEqual(await ok.json(),{status:'pending_review'});assert.deepEqual(called,[['valid','2647636']]);
 for(const b of [{adAccountId:'2647636',userId:other},{adAccountId:'0'},{adAccountId:2647636},{adAccountId:'2647636',approved:true}]) assert.equal((await handler(req('POST',undefined,JSON.stringify(b)))).status,400);
});
test('limits origins, rejects fake sessions and rate limit failures',async()=>{
 const {handler}=fixture();assert.equal((await handler(req('GET',undefined,undefined,{origin:'https://evil.test'}))).status,403);assert.equal((await handler(req('GET',undefined,undefined,{authorization:'Bearer invalid'}))).status,401);
 assert.equal((await fixture({memberAllowed:async()=>false}).handler(req('GET'))).status,403);assert.equal((await fixture({allowRequest:async()=>false}).handler(req('GET'))).status,429);
});
test('redacts list results and rejects cross-user rows',async()=>{
 const r=await fixture().handler(req('GET'));assert.deepEqual(await r.json(),{connections:[{requestId:rid,adAccountId:'2647636',status:'pending_review'}]});
 const denied=await fixture({listOwned:async()=>[{userId:other,requestId:rid,adAccountId:'2647636',status:'read_connected'}]}).handler(req('GET'));assert.equal(denied.status,503);
});
test('no approval route exists and preflight restricts origins and headers',async()=>{
 const {handler}=fixture();assert.equal((await handler(req('POST','/api/ad-connections/approve','{}'))).status,404);
 const opt=await handler(new Request('https://api.test/api/ad-connections',{method:'OPTIONS',headers:{origin:'https://example.test','access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}}));assert.equal(opt.status,204);
 const bad=await handler(new Request('https://api.test/api/ad-connections',{method:'OPTIONS',headers:{origin:'https://example.test','access-control-request-method':'POST','access-control-request-headers':'x-elevate'}}));assert.equal(bad.status,403);
});
test('fails closed for auth service errors, large bodies and invalid auth users',async()=>{
 assert.equal((await fixture({verifySession:async()=>{throw Error('offline')}}).handler(req('GET'))).status,503);
 assert.equal((await fixture({memberAllowed:async()=>{throw Error('offline')}}).handler(req('GET'))).status,503);
 const {handler}=fixture(); assert.equal((await handler(req('POST',undefined,JSON.stringify({adAccountId:'1'.repeat(2000)})))).status,400);
 const ver=createSupabaseSessionVerifier({auth:{getUser:async()=>({data:{user:{id:user,aud:'anon'}}})}});assert.equal(await ver('valid'),null);
 const revoked=createSupabaseSessionVerifier({auth:{getUser:async()=>({data:{user:null},error:{message:'expired'}})}});assert.equal(await revoked('expired'),null);
});
