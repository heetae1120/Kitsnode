import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('document schema isolates append-only records, current pointers, and legacy grants', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    for (const file of ['20261109142215_kitsnode_member_auth_support.sql','20261109143636_member_auth_shared_rate_limit.sql','20261109143737_member_auth_staging_privileges.sql','20261110063351_member_document_consents.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
    }
    const digest = 'a'.repeat(64);
    await db.query("INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ('terms','t1','terms',$1), ('privacy','p1','privacy',$1)",[digest]);
    await db.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','t1'),('privacy','p1')");
    await assert.rejects(db.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('privacy','missing')"));
    await db.exec('SET ROLE member_auth_runtime');
    await db.exec("INSERT INTO member_auth_support.document_consents(user_id,document_type,version) VALUES ('test-user','terms','t1')");
    assert.equal((await db.query('SELECT count(*)::int AS n FROM member_auth_support.document_consents')).rows[0].n,1);
    await assert.rejects(db.exec("UPDATE member_auth_support.document_versions SET body='changed'"));
    await assert.rejects(db.exec("DELETE FROM member_auth_support.document_consents"));
    await assert.rejects(db.exec("UPDATE member_auth_support.document_current SET version='t1'"));
    await assert.rejects(db.query('SELECT * FROM member_auth_support.consents'));
    await db.exec('RESET ROLE; SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM member_auth_support.document_versions'));
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await assert.rejects(db.query('SELECT * FROM member_auth_support.document_consents'));
    await db.exec('RESET ROLE; SET ROLE service_role');
    await assert.rejects(db.query('SELECT * FROM member_auth_support.document_versions'));
    await db.exec('RESET ROLE');
  } finally { await db.close(); }
});

test('a service login inherits only runtime document grants and cannot change current pointers', async () => {
 const db=new PGlite();
 try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const name of ['20261109142215_kitsnode_member_auth_support.sql','20261109143636_member_auth_shared_rate_limit.sql','20261109143737_member_auth_staging_privileges.sql','20261110063351_member_document_consents.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec("CREATE ROLE document_service_test LOGIN INHERIT; GRANT member_auth_runtime TO document_service_test");
  await db.query("INSERT INTO member_auth_support.document_versions(document_type,version,body,digest) VALUES ('terms','t1','terms',$1),('privacy','p1','privacy',$1)",['a'.repeat(64)]);
  await db.exec("INSERT INTO member_auth_support.document_current(document_type,version) VALUES ('terms','t1'),('privacy','p1'); SET ROLE document_service_test");
  assert.equal((await db.query('SELECT count(*)::int AS n FROM member_auth_support.document_current')).rows[0].n,2);
  await db.exec("INSERT INTO member_auth_support.document_consents(user_id,document_type,version) VALUES ('synthetic','privacy','p1')");
  await assert.rejects(db.exec("UPDATE member_auth_support.document_current SET version='p1'"));
  await assert.rejects(db.exec("DELETE FROM member_auth_support.document_consents"));
  await assert.rejects(db.query('SELECT * FROM member_auth_support.consents'));
  await db.exec('RESET ROLE');
 } finally {await db.close()}
});
