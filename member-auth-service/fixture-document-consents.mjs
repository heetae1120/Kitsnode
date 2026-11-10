import { createHash } from 'node:crypto';

// Fixture-only SQLite tables. Never use these tables as an operating data model.
export function createFixtureDocumentConsents(db, documents) {
  if (!Array.isArray(documents) || documents.length !== 2 || documents[0]?.type !== 'terms' || documents[1]?.type !== 'privacy' || documents.some(d => typeof d.version !== 'string' || !d.version.trim() || typeof d.text !== 'string' || !d.text.trim())) throw new Error('Invalid fixture documents');
  db.exec('CREATE TABLE IF NOT EXISTS fixture_documents (type TEXT NOT NULL, version TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY (type, version)); CREATE TABLE IF NOT EXISTS fixture_document_consents (user_id TEXT NOT NULL, type TEXT NOT NULL, version TEXT NOT NULL, accepted_at TEXT NOT NULL, PRIMARY KEY (user_id, type, version), FOREIGN KEY (type, version) REFERENCES fixture_documents(type, version));');
  const register = db.prepare('INSERT OR IGNORE INTO fixture_documents (type, version, digest) VALUES (?, ?, ?)');
  const lookup = db.prepare('SELECT digest FROM fixture_documents WHERE type = ? AND version = ?');
  for (const doc of documents) {
    const digest = createHash('sha256').update(doc.text).digest('hex');
    register.run(doc.type, doc.version, digest);
    if (lookup.get(doc.type, doc.version)?.digest !== digest) throw new Error('Document version already has different text');
  }
  function valid(consents, { requireAll = true } = {}) {
    return Array.isArray(consents) && consents.length > 0 && consents.length <= documents.length && (!requireAll || consents.length === documents.length) && new Set(consents.map(c => c?.type)).size === consents.length && consents.every(c => c && Object.keys(c).sort().join(',') === 'accepted,type,version' && c.accepted === true && documents.some(doc => c.type === doc.type && c.version === doc.version));
  }
  return {
    valid,
    status(userId) {
      return Object.fromEntries(documents.map(d => [d.type, !!userId && !!db.prepare('SELECT 1 FROM fixture_document_consents WHERE user_id = ? AND type = ? AND version = ?').get(userId, d.type, d.version)]));
    },
    hasAccepted(userId) {
      return documents.every(d => !!userId && !!db.prepare('SELECT 1 FROM fixture_document_consents WHERE user_id = ? AND type = ? AND version = ?').get(userId, d.type, d.version));
    },
    record(userId, consents) {
      if (!userId || !valid(consents, {requireAll:false})) return false;
      db.exec('BEGIN');
      try {
        const insert = db.prepare('INSERT OR IGNORE INTO fixture_document_consents (user_id, type, version, accepted_at) VALUES (?, ?, ?, ?)');
        const timestamp = new Date().toISOString();
        for (const d of consents) insert.run(userId, d.type, d.version, timestamp);
        db.exec('COMMIT');
        return true;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
}
