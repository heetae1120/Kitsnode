import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startSiteSession,clearAnalyticsSession} from '../src/lib/analytics-session';
const id='491b857a-7641-4cef-8a22-28d383a498c2';
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}} as Storage;}
test('site entry creates one tab session and activity extends the 30 minute window',()=>{
 const s=storage();let calls=0;const next=()=>{calls++;return id;};
 assert.deepEqual(startSiteSession(s,1000,next),{id,created:true});
 assert.deepEqual(startSiteSession(s,1_000_000,next),{id,created:false});
 assert.equal(calls,1);assert.deepEqual(startSiteSession(s,2_800_001,next),{id,created:true});
 assert.deepEqual(startSiteSession(s,2_800_002,next),{id,created:false});
 clearAnalyticsSession(s);assert.deepEqual(startSiteSession(s,2_800_003,next),{id,created:true});
});
test('storage unavailable and invalid IDs fail closed',()=>{
 assert.equal(startSiteSession(null,1,()=>id),null);
 assert.equal(startSiteSession(storage(),1,()=> 'bad'),null);
});

test('site sessions are sent with bounded categories and no credentials', async()=>{
 const {sendSiteSession}=await import('../src/lib/analytics-session');
 let url='';let init:RequestInit|undefined;
 const fetcher=(async(u:string|URL|Request,options?:RequestInit)=>{url=String(u);init=options;return new Response('{}');}) as typeof fetch;
 sendSiteSession('https://example.test/collect',id,{source:'instagram',medium:'social',campaign:'none',basis:'referrer'},fetcher);
 assert.equal(url,'https://example.test/collect?resource=session');assert.equal(init?.credentials,'omit');
 assert.deepEqual(JSON.parse(String(init?.body)),{version:1,sessionId:id,landing:'site',attribution:{source:'instagram',medium:'social',campaign:'none',basis:'referrer'}});
});
