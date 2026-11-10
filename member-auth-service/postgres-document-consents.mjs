import {createHash} from 'node:crypto';

export function validateDocuments(documents) {
 if (!Array.isArray(documents) || documents.length !== 2 || documents[0]?.type !== 'terms' || documents[1]?.type !== 'privacy' || documents.some(d => !d || typeof d.version !== 'string' || d.version.trim() !== d.version || !d.version || d.version.length > 128 || typeof d.text !== 'string' || !d.text.trim() || Buffer.byteLength(d.text,'utf8') > 1024*1024)) throw new Error('Invalid consent documents');
 return documents;
}
export function validateDocumentConsents(documents, consents, requireAll = true) {
 return Array.isArray(consents) && consents.length > 0 && consents.length <= documents.length && (!requireAll || consents.length === documents.length) && new Set(consents.map(c=>c?.type)).size === consents.length && consents.every(c=>c && Object.keys(c).sort().join(',') === 'accepted,type,version' && c.accepted === true && documents.some(d=>d.type===c.type && d.version===c.version));
}
export function createPostgresDocumentConsents(pool, documents) {
 validateDocuments(documents);
 if (!pool?.query) throw new Error('Database unavailable');
 return {
  async register() {
   for (const d of documents) {
    const hash=createHash('sha256').update(d.text,'utf8').digest('hex');
    const result=await pool.query(`INSERT INTO member_auth_support.consent_documents AS d (type,version,digest) VALUES ($1,$2,$3)
     ON CONFLICT (type,version) DO UPDATE SET digest=d.digest WHERE d.digest=EXCLUDED.digest RETURNING type`,[d.type,d.version,hash]);
    if (result.rows.length!==1) throw new Error('Document version already has different text');
   }
  },
  async status(userId) {
   if (typeof userId !== 'string' || !userId || userId.length>256) throw new Error('Invalid user');
   const result=await pool.query(`SELECT type,version FROM member_auth_support.member_document_acceptances WHERE user_id=$1 AND ((type=$2 AND version=$3) OR (type=$4 AND version=$5))`,[userId,documents[0].type,documents[0].version,documents[1].type,documents[1].version]);
   return Object.fromEntries(documents.map(d=>[d.type,result.rows.some(r=>r.type===d.type && r.version===d.version)]));
  },
  async record(userId, consents) {
   if (typeof userId !== 'string' || !userId || userId.length>256 || !validateDocumentConsents(documents,consents,false)) throw new Error('Invalid consent');
   // One SQL statement: multiple consent records succeed or fail together.
   await pool.query(`INSERT INTO member_auth_support.member_document_acceptances (user_id,type,version) SELECT $1,x.type,x.version FROM jsonb_to_recordset($2::jsonb) AS x(type text,version text) ON CONFLICT (user_id,type,version) DO NOTHING`,[userId,JSON.stringify(consents.map(({type,version})=>({type,version})))]);
  }
 };
}
