import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentConsentStore} from './document-consents.mjs';

const documents=[{type:'terms',version:'t1',text:'terms'},{type:'privacy',version:'p1',text:'privacy'}];
function mockDatabase(){
 let admissionHeld=false,active=0,peak=0,shared=0,failTry=false;
 return {
  get active(){return active;},get peak(){return peak;},get shared(){return shared;},
  failNextTry(){failTry=true;},
  query:async()=>({rows:[]}),
  async connect(){active++;peak=Math.max(peak,active);let ownsAdmission=false,released=false;
   return {async query(sql){
    if(sql.includes('pg_try_advisory_xact_lock(')){
     if(failTry){failTry=false;throw new Error('synthetic DB error');}
     const acquired=!admissionHeld;if(acquired){admissionHeld=true;ownsAdmission=true;}
     return {rows:[{acquired}]};
    }
    if(sql.includes('pg_advisory_xact_lock_shared'))shared++;
    if(sql.includes('SELECT document_type,version'))return {rows:documents.map(({type,version})=>({document_type:type,version}))};
    if((sql==='ROLLBACK'||sql==='COMMIT') && ownsAdmission){admissionHeld=false;ownsAdmission=false;}
    return {rows:[]};
   },release(){assert.equal(released,false);released=true;active--;}};
  }
 };
}

test('cross-worker signup admission rejects a second worker before it takes a shared document lock',async()=>{
 const pool=mockDatabase(),first=createDocumentConsentStore(pool,documents),second=createDocumentConsentStore(pool,documents);
 let start,finish;const entered=new Promise(resolve=>{start=resolve}),held=new Promise(resolve=>{finish=resolve});
 const one=first.withCurrent(async()=>{start();await held;return 'ok';},{signup:true});
 await entered;
 await assert.rejects(second.withCurrent(()=>{throw Error('must not run');},{signup:true}),/temporarily busy/);
 assert.equal(pool.shared,1);assert.equal(pool.active,1);finish();assert.equal(await one,'ok');
 assert.equal(await second.withCurrent(()=>42,{signup:true}),42);assert.equal(pool.active,0);
});

test('failed admission query rolls back and unblocks the instance queue',async()=>{
 const pool=mockDatabase(),store=createDocumentConsentStore(pool,documents);pool.failNextTry();
 const first=store.withCurrent(()=>0,{signup:true});const second=store.withCurrent(()=>1,{signup:true});
 await assert.rejects(first,/synthetic DB error/);assert.equal(await second,1);assert.equal(pool.active,0);assert.equal(pool.peak,1);
});
