import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresSupport } from './postgres-support.mjs';

async function dbFixture() {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../supabase/migrations/20261109142215_kitsnode_member_auth_support.sql', import.meta.url), 'utf8'));
  return db;
}

test('versioned consent is immutable and scoped to the authenticated identifier', async () => {
  const db = await dbFixture();
  try {
    const store = createPostgresSupport(db);
    await store.registerTerms({version:'v1',text:'Synthetic terms only'});
    await store.registerTerms({version:'v1',text:'Synthetic terms only'});
    await assert.rejects(store.registerTerms({version:'v1',text:'Different terms'}), /different text/);
    const competing = await Promise.allSettled([
      store.registerTerms({version:'race-v1',text:'Terms A'}),
      store.registerTerms({version:'race-v1',text:'Terms B'}),
    ]);
    assert.equal(competing.filter(result => result.status === 'fulfilled').length,1);
    assert.equal(await store.hasAccepted({userId:'member-1',version:'v1'}), false);
    await store.recordAcceptance({userId:'member-1',version:'v1'});
    await store.recordAcceptance({userId:'member-1',version:'v1'});
    assert.equal(await store.hasAccepted({userId:'member-1',version:'v1'}), true);
    assert.equal(await store.hasAccepted({userId:'member-2',version:'v1'}), false);
    await assert.rejects(store.recordAcceptance({userId:'member-1',version:'not-registered'}));
    assert.equal((await db.query('SELECT count(*)::int AS count FROM member_auth_support.consents')).rows[0].count,1);
    await db.exec('CREATE ROLE member_untrusted; SET ROLE member_untrusted');
    await assert.rejects(db.query('SELECT * FROM member_auth_support.consents'), /permission denied/);
    await db.exec('RESET ROLE');
  } finally { await db.close(); }
});

test('atomic state claims reject duplicate concurrent attempts and fail closed', async () => {
  const db = await dbFixture();
  try {
    const store = createPostgresSupport(db);
    const digest = 'a'.repeat(64);
    const results = await Promise.all(Array.from({length:12}, () => store.claimState(digest)));
    assert.equal(results.filter(Boolean).length,1);
    assert.equal(await store.claimState(digest),false);
    assert.equal(await store.claimState('invalid'),false);
    await db.query("UPDATE member_auth_support.oauth_state_claims SET expires_at = now() - interval '1 second' WHERE digest = $1", [digest]);
    await store.pruneExpiredClaims();
    assert.equal((await db.query('SELECT count(*)::int AS count FROM member_auth_support.oauth_state_claims')).rows[0].count,0);
    const unavailable = createPostgresSupport({query: async () => { throw new Error('unavailable'); }});
    await assert.rejects(unavailable.claimState('b'.repeat(64)),/unavailable/);
  } finally { await db.close(); }
});
