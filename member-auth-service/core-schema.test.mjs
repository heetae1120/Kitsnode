import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {getAuthTables} from '@better-auth/core/db';

test('core staging schema matches pinned Better Auth fields and restricts role access',async()=>{
 const db=new PGlite();
 try {
  const migrations=['20261109142215_kitsnode_member_auth_support.sql','20261109143636_member_auth_shared_rate_limit.sql','20261109143737_member_auth_staging_privileges.sql','20261109143906_member_auth_core_staging.sql'];
  for(const file of migrations) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const expected=getAuthTables({});
  for(const [name,table] of Object.entries(expected)) {
   const columns=await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['member_auth',name]);
   assert.deepEqual(new Set(columns.rows.map(x=>x.column_name)),new Set(['id',...Object.values(table.fields).map(x=>x.fieldName)]));
  }
  await db.exec('CREATE ROLE unrelated_test NOLOGIN; SET ROLE unrelated_test');
  await assert.rejects(db.query('SELECT * FROM member_auth."user"'));
  await db.exec('RESET ROLE; SET ROLE member_auth_runtime');
  await db.query('INSERT INTO member_auth."user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())',['u1','Fixture','fixture@example.test',false]);
  assert.equal((await db.query('SELECT id FROM member_auth."user"')).rows[0].id,'u1');
  await assert.rejects(db.exec('CREATE TABLE member_auth.unauthorized (id text)'));
 } finally {await db.close();}
});
