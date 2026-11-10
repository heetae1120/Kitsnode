import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createStateCleanupWorker} from './state-cleanup-worker.mjs';

const env={MEMBER_STATE_CLEANUP_ENABLED:'1',MAINTENANCE_HYPERDRIVE:{connectionString:'fixture'}};
const controller={cron:'0 18 * * *'};

test('cleanup deletes only expired claims',async()=>{
  const db=new PGlite();
  await db.exec('CREATE SCHEMA member_auth_support; CREATE TABLE member_auth_support.oauth_state_claims (digest text PRIMARY KEY, expires_at timestamptz NOT NULL)');
  await db.query("INSERT INTO member_auth_support.oauth_state_claims SELECT 'expired-'||n,now()-interval '1 hour' FROM generate_series(1,501) n");
  await db.query("INSERT INTO member_auth_support.oauth_state_claims VALUES ('future',now()+interval '1 hour')");
  let ended=false;
  const worker=createStateCleanupWorker({createClient:()=>({connect:async()=>{},query:async sql=>{if(sql.includes('current_user'))return {rows:[{allowed:true}]};const r=await db.query(sql);return {...r,rowCount:r.affectedRows}},end:async()=>{ended=true}})});
  try { await worker.scheduled(controller,env); const result=await db.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE digest='future')::int AS future FROM member_auth_support.oauth_state_claims"); assert.deepEqual(result.rows[0],{n:1,future:1});assert.equal(ended,true); }
  finally {await db.close()}
});

test('disabled, wrong cron, wrong database role and errors fail closed',async()=>{
  let queries=0,closed=0;
  const w=createStateCleanupWorker({createClient:()=>({connect:async()=>{},query:async()=>{queries++;return {rows:[{allowed:false}]}},end:async()=>{closed++}})});
  await assert.rejects(w.scheduled(controller,{...env,MEMBER_STATE_CLEANUP_ENABLED:'0'}));
  await assert.rejects(w.scheduled({cron:'* * * * *'},env));
  assert.equal(queries,0);
  await assert.rejects(w.scheduled(controller,env),/State cleanup failed/);
  assert.equal(queries,1);assert.equal(closed,1);
  assert.equal((await w.fetch()).status,404);
});
