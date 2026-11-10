import test from 'node:test';
import assert from 'node:assert/strict';
import {probeIsolatedHyperdrive} from './hyperdrive-isolation-probe.mjs';
function mockPool({max=6,db='kitsnode_probe_db',role='kitsnode_probe_role'}={}) {
 let active=0,lockOwner=null,sequence=0;const queue=[];
 function create(){active++;const id=++sequence;return {async query(q){
  if(q.startsWith('SELECT current_database'))return {rows:[{database:db,role}]};
  if(q.startsWith('SELECT pg_advisory_xact_lock')){lockOwner=id;return {rows:[]};}
  if(q.startsWith('SELECT pg_try_advisory_xact_lock')){let acquired=lockOwner===null||lockOwner===id;if(acquired)lockOwner=id;return {rows:[{acquired}]};}
  if(q==='COMMIT'||q==='ROLLBACK'){if(lockOwner===id)lockOwner=null;}
  return {rows:[]};
 },release(){active--;const next=queue.shift();if(next)next(create());}};}
 return {connect(){return active<max?Promise.resolve(create()):new Promise(resolve=>queue.push(resolve))},get active(){return active}};
}
const config={isolationConfirmed:true,expectedDatabase:'kitsnode_probe_db',expectedRole:'kitsnode_probe_role',acquireTimeoutMs:100};
test('verifies exclusion, commit and rollback and reports bounded saturation',async()=>{
 const pool=mockPool({max:2});const r=await probeIsolatedHyperdrive({pool,...config,concurrency:4});
 assert.equal(r.lockExcluded,true);assert.equal(r.commitReleased,true);assert.equal(r.rollbackReleased,true);assert.equal(r.acquired,2);assert.equal(r.timedOut,2);
 await new Promise(r=>setTimeout(r,10));assert.equal(pool.active,0);
});
test('fails closed for absent isolation and unexpected database identity',async()=>{
 const pool=mockPool({db:'postgres'});
 await assert.rejects(probeIsolatedHyperdrive({pool,...config,isolationConfirmed:false}));
 await assert.rejects(probeIsolatedHyperdrive({pool,...config}),/identity mismatch/);assert.equal(pool.active,0);
 await assert.rejects(probeIsolatedHyperdrive({pool,...config,expectedRole:'postgres'}),/configuration/);
});
