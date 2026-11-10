import {createHash} from 'node:crypto';

const TYPES=['terms','privacy'];
export function validateDocuments(documents) {
  if (!Array.isArray(documents) || documents.length !== 2 || documents.some((d,i)=>!d || d.type!==TYPES[i] || typeof d.version!=='string' || !d.version.trim() || d.version!==d.version.trim() || d.version.length>128 || typeof d.text!=='string' || !d.text.trim() || Buffer.byteLength(d.text,'utf8')>1024*1024)) throw new Error('Invalid documents');
  return documents.map(d=>({type:d.type,version:d.version,text:d.text}));
}
export function validDocumentSelections(consents,documents,{requireAll=false}={}) {
 return Array.isArray(consents) && consents.length>0 && consents.length<=2 && (!requireAll||consents.length===2) && new Set(consents.map(c=>c?.type)).size===consents.length && consents.every(c=>c && Object.keys(c).sort().join(',')==='accepted,type,version' && c.accepted===true && documents.some(d=>d.type===c.type && d.version===c.version));
}
export function createDocumentConsentStore(pool,configured) {
 const documents=validateDocuments(configured);
 if (!pool || typeof pool.query!=='function') throw new Error('Database required');
 const safeUser=id=>typeof id==='string' && !!id.trim() && id===id.trim() && id.length<=256;
 // Prevent concurrent lock holders in this instance from exhausting a bounded
 // two-connection pool while the auth handler needs its own connection.
 let pending=Promise.resolve();
 async function serialize(callback){
  const previous=pending; let release;
  pending=new Promise(resolve=>{release=resolve;});
  await previous;
  try {return await callback();} finally {release();}
 }
 return {
  documents,
  async register(){
   for(const d of documents){
    const hash=createHash('sha256').update(d.text,'utf8').digest('hex');
    await pool.query('INSERT INTO member_auth_support.document_versions (document_type,version,body,digest) VALUES ($1,$2,$3,$4) ON CONFLICT (document_type,version) DO NOTHING',[d.type,d.version,d.text,hash]);
    const r=await pool.query('SELECT body,digest FROM member_auth_support.document_versions WHERE document_type=$1 AND version=$2',[d.type,d.version]);
    if(r.rows.length!==1 || r.rows[0].body!==d.text || r.rows[0].digest!==hash) throw new Error('Document version already has different text');
   }
   await this.assertCurrent();
  },
  async assertCurrent(){
   const r=await pool.query('SELECT document_type,version FROM member_auth_support.document_current WHERE document_type = ANY($1::text[])',[TYPES]);
   if(r.rows.length!==2 || !documents.every(d=>r.rows.some(row=>row.document_type===d.type && row.version===d.version))) throw new Error('Documents not current');
  },
  async withCurrent(callback,{signup=false}={}){
   if(typeof signup !== 'boolean') throw new Error('Invalid admission mode');
   return serialize(async()=>{
   if(typeof pool.connect !== 'function') throw new Error('Transactional connection required');
   const client=await pool.connect();
   try {
    await client.query('BEGIN');
    // A non-blocking, cross-worker admission guard ensures that only one
    // signup can hold a document lock while seeking an auth DB connection.
    // This is a conservative single-flight limit, not a guarantee that the
    // upstream pool has free capacity when unrelated workloads use it.
    if(signup){
     const admission=await client.query('SELECT pg_try_advisory_xact_lock(149909178438::bigint) AS acquired');
     if(admission.rows.length!==1 || admission.rows[0].acquired!==true) throw new Error('Signup temporarily busy');
    }
    await client.query('SELECT pg_advisory_xact_lock_shared(149909178437::bigint)');
    const active=await client.query('SELECT document_type,version FROM member_auth_support.document_current WHERE document_type = ANY($1::text[])',[TYPES]);
    if(active.rows.length!==2 || !documents.every(d=>active.rows.some(r=>r.document_type===d.type && r.version===d.version))) throw new Error('Documents not current');
    const result=await callback();
    await client.query('COMMIT');
    return result;
   } catch(error) { try {await client.query('ROLLBACK');} catch {} throw error; }
   finally {client.release();}
   });
  },
  async status(userId){
   // Read current pointers and this member's status in one snapshot. A worker
   // configured for an obsolete document must never authorize based on it.
   const r=await pool.query(`SELECT c.document_type,c.version,EXISTS(SELECT 1 FROM member_auth_support.document_consents d WHERE d.user_id=$1 AND d.document_type=c.document_type AND d.version=c.version) AS accepted FROM member_auth_support.document_current c WHERE c.document_type = ANY($2::text[])`,[safeUser(userId)?userId:'',TYPES]);
   if(r.rows.length!==2 || !documents.every(d=>r.rows.some(row=>row.document_type===d.type && row.version===d.version))) throw new Error('Documents not current');
   return Object.fromEntries(documents.map(d=>[d.type,safeUser(userId) && r.rows.some(row=>row.document_type===d.type && row.accepted===true)]));
  },
  async record(userId,selections){
   if(!safeUser(userId)||!validDocumentSelections(selections,documents)) throw new Error('Invalid consent');
   return serialize(async()=>{
   if(typeof pool.connect !== 'function') throw new Error('Transactional connection required');
   const client=await pool.connect();
   try {
    await client.query('BEGIN');
    // A separate statement after the shared advisory lock obtains a fresh READ
    // COMMITTED snapshot even when an administrator was switching versions.
    await client.query('SELECT pg_advisory_xact_lock_shared(149909178437::bigint)');
    const active=await client.query('SELECT document_type,version FROM member_auth_support.document_current WHERE document_type = ANY($1::text[])',[TYPES]);
    if(active.rows.length!==2 || !documents.every(d=>active.rows.some(r=>r.document_type===d.type && r.version===d.version))) throw new Error('Documents not current');
    for(const c of selections) await client.query('INSERT INTO member_auth_support.document_consents (user_id,document_type,version) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[userId,c.type,c.version]);
    await client.query('COMMIT');
   } catch(error) { try {await client.query('ROLLBACK');} catch {} throw error; }
   finally {client.release();}
   });
  }
 };
}
