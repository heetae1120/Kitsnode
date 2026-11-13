import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startMainSession,clearAnalyticsSession} from '../src/lib/analytics-session';
import {classifyAttribution} from '../src/lib/analytics-attribution';
const attr=classifyAttribution('', 'https://www.instagram.com/', 'https://site.example');
const id='491b857a-7641-4cef-8a22-28d383a498c2';
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}} as Storage;}
test('main entry creates one tab session and activity extends the 30 minute window',()=>{
 const s=storage();let calls=0;const next=()=>{calls++;return id;};
 assert.deepEqual(startMainSession(s,1000,next,true,attr),{id,created:true});
 assert.deepEqual(startMainSession(s,1_000_000,next,false,attr),{id,created:false});
 assert.equal(calls,1);assert.equal(startMainSession(s,2_800_001,next,false,attr),null);
 assert.deepEqual(startMainSession(s,2_800_002,next,true,attr),{id,created:true});
 clearAnalyticsSession(s);assert.equal(startMainSession(s,2_800_003,next,false,attr),null);
});
test('storage unavailable, internal navigation and invalid IDs fail closed',()=>{
 assert.equal(startMainSession(null,1,()=>id,true,attr),null);
 assert.equal(startMainSession(storage(),1,()=>id,true,{...attr,basis:'internal'}),null);
 assert.equal(startMainSession(storage(),1,()=> 'bad',true,attr),null);
});
