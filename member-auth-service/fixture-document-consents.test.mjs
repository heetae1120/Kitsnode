import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createFixtureDocumentConsents } from './fixture-document-consents.mjs';

test('document versions are immutable and changing one preserves the other consent', () => {
  const db = new DatabaseSync(':memory:');
  const docs = [{type:'terms',version:'t1',text:'terms v1'},{type:'privacy',version:'p1',text:'privacy v1'}];
  try {
    const first = createFixtureDocumentConsents(db,docs);
    const accepted = docs.map(({type,version}) => ({type,version,accepted:true}));
    assert.equal(first.record('one',accepted),true);
    assert.equal(first.hasAccepted('one'),true);
    assert.equal(first.hasAccepted('other'),false);
    assert.throws(() => createFixtureDocumentConsents(db,[{...docs[0],text:'changed'},docs[1]]),/different text/);
    const updated = createFixtureDocumentConsents(db,[docs[0],{...docs[1],version:'p2',text:'privacy v2'}]);
    assert.deepEqual(updated.status('one'),{terms:true,privacy:false});
    assert.equal(updated.hasAccepted('one'),false);
    assert.equal(updated.record('one',[{type:'privacy',version:'p1',accepted:true}]),false);
    assert.equal(updated.record('one',[{type:'privacy',version:'p2',accepted:true}]),true);
    assert.equal(updated.hasAccepted('one'),true);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixture_document_consents WHERE user_id = ?').get('one').n,3);
  } finally { db.close(); }
});
