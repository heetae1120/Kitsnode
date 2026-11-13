import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basicCollectionAllowed,sendBasicLoad} from '../src/lib/analytics-basic';
const store=(data:Record<string,string>)=>({getItem:(key:string)=>data[key]??null,setItem:()=>{}});
test('basic count respects saved refusal and unreadable storage',()=>{
 assert.equal(basicCollectionAllowed(null),false);
 assert.equal(basicCollectionAllowed({getItem:()=>{throw Error('blocked');},setItem(){}}),false);
 assert.equal(basicCollectionAllowed(store({})),true);
 assert.equal(basicCollectionAllowed({getItem:(key:string)=>{if(key.endsWith('v1')) throw Error('blocked');return null;},setItem(){}}),false);
 assert.equal(basicCollectionAllowed(store({'kitsnode-analytics-consent-v4':'deny'})),false);
 assert.equal(basicCollectionAllowed(store({'kitsnode-analytics-consent-v3':'deny'})),false);
 assert.equal(basicCollectionAllowed(store({'kitsnode-analytics-consent-v4':'allow','kitsnode-analytics-consent-v3':'deny'})),true);
});
test('basic request contains only a protocol version and omits credentials',async()=>{
 let options:RequestInit|undefined;let url='';
 const f=(async(u:string|URL|Request,init?:RequestInit)=>{url=String(u);options=init;return new Response('{}');}) as typeof fetch;
 await sendBasicLoad('https://example.test/collect',f);
 assert.equal(url,'https://example.test/collect?resource=basic');assert.deepEqual(JSON.parse(String(options?.body)),{version:1});assert.equal(options?.credentials,'omit');assert.equal(options?.referrerPolicy,'no-referrer');
});
