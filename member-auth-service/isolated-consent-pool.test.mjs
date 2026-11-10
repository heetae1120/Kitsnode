import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedConsentPool} from './isolated-consent-pool.mjs';

test('test pool checks role and keeps queries and locks out of production namespace', async () => {
  const calls=[];
  const role={role:'kitsnode_auth_test_runtime',test_schema:true,auth_schema:false,support_schema:false,insert_consent:true,update_current:false};
  const client={query:async (sql,values)=>{calls.push([sql,values]);return {rows:[]}},release:()=>calls.push(['released'])};
  const pool={query:async (sql,values)=>{if(sql.includes('current_user AS role')) return {rows:[role]}; calls.push([sql,values]); return {rows:[]}},connect:async()=>client};
  const testPool=await createIsolatedConsentPool(pool);
  await testPool.query('SELECT * FROM member_auth_support.document_current WHERE version=$1',['v1']);
  const c=await testPool.connect();
  await c.query('SELECT pg_advisory_xact_lock_shared(149909178437::bigint)');
  c.release();
  assert.match(calls[0][0],/kitsnode_auth_test\.document_current/);
  assert.deepEqual(calls[0][1],['v1']);
  assert.match(calls[1][0],/149909178537/);
  role.support_schema=true;
  await assert.rejects(createIsolatedConsentPool(pool),/privileges invalid/);
});
