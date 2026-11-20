// ISOLATED REVIEW CANDIDATE: no HTTP route, DB, app, key store or deployment.
// A trusted document source must return the EXACT active UTF-8 bytes shown to the
// user, with an administrator-owned revision that changes whenever bytes change.
// A trusted session verifier must validate the token AND active session server-side.
// The final DB write MUST recheck session, documents, consent and profile atomically.
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const uuid=v=>typeof v==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const version=v=>typeof v==='string' && /^[A-Za-z0-9._-]{1,64}$/.test(v);
const kidValid=v=>typeof v==='string' && /^[A-Za-z0-9_-]{1,32}$/.test(v);
const tokenValid=v=>typeof v==='string' && v.length>0 && v.length<=8192 && !/\s/.test(v);
const metadataKeys=['termsVersion','privacyVersion','termsSha256','privacySha256','revision'];
const exact=(v,keys)=>v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const validMeta=v=>exact(v,metadataKeys) && version(v.termsVersion) && version(v.privacyVersion) && typeof v.termsSha256==='string' && typeof v.privacySha256==='string' && /^[0-9a-f]{64}$/.test(v.termsSha256) && /^[0-9a-f]{64}$/.test(v.privacySha256) && Number.isSafeInteger(v.revision) && v.revision>0;
const sameMeta=(a,b)=>metadataKeys.every(k=>a[k]===b[k]);
const fail=code=>({ok:false,code});

function readDocument(doc,maxBytes) {
  if (!doc || !version(doc.version) || !(doc.bytes instanceof Uint8Array)) return null;
  const bytes=Buffer.from(doc.bytes); // freeze a private snapshot before any await
  if (!bytes.length || bytes.length>maxBytes) return null;
  let body;try {body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return null;}
  // Reject UTF-8 BOM (TextDecoder strips it), nul bytes and any lossy decoding.
  if (body.includes('\0') || !Buffer.from(body,'utf8').equals(bytes)) return null;
  return {version:doc.version,body,sha256:createHash('sha256').update(bytes).digest('hex')};
}
function snapshot(source,maxBytes) {
  if (!source || !Number.isSafeInteger(source.revision) || source.revision<1) return null;
  const terms=readDocument(source.terms,maxBytes),privacy=readDocument(source.privacy,maxBytes);
  if(!terms || !privacy) return null;
  return {terms,privacy,metadata:{termsVersion:terms.version,privacyVersion:privacy.version,termsSha256:terms.sha256,privacySha256:privacy.sha256,revision:source.revision}};
}
function readClock(now) {const n=now();if(!Number.isSafeInteger(n)||n<0)throw new Error('invalid_clock');return n;}
function encoded(buffer){return Buffer.from(buffer).toString('base64url');}
function decoded(value,max) {
  if(typeof value!=='string'||!value||value.length>max||!/^[A-Za-z0-9_-]+$/.test(value))return null;
  const out=Buffer.from(value,'base64url');return encoded(out)===value?out:null;
}
function mac(key,head,payload,userId,sessionId) {
  // IDs do not appear in the receipt: they are contextual HMAC input only.
  return createHmac('sha256',key).update('kitsnode-document-receipt-v1\0').update(head).update('\0').update(payload).update('\0').update(userId.toLowerCase()).update('\0').update(sessionId.toLowerCase()).digest();
}

/**
 * verifySession(token) must remotely validate JWT signature, subject and current
 * session status; return {id,sessionId}, never browser-supplied identity data.
 * readActiveDocuments() must read one consistent server-controlled snapshot of
 * raw bytes, version and revision; it must never trust request input.
 * The signing key set must come from a protected rotating key manager. Both
 * dependencies are deliberately required and not provided by this module.
 */
export function createMemberDocumentReceiptCandidate({verifySession,readActiveDocuments,keys,activeKeyId,now=Date.now,ttlMs=5*60*1000,maxBytes=200*1024}) {
  if(typeof verifySession!=='function'||typeof readActiveDocuments!=='function'||typeof now!=='function'||!kidValid(activeKeyId)||!keys||typeof keys!=='object'||Array.isArray(keys)||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>15*60*1000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1024*1024)throw new TypeError('invalid_dependencies');
  const keyset=new Map();
  for(const [id,key] of Object.entries(keys)) {if(!kidValid(id)||!Buffer.isBuffer(key)||key.length<32)throw new TypeError('invalid_keys');keyset.set(id,Buffer.from(key));}
  if(!keyset.has(activeKeyId))throw new TypeError('invalid_keys');
  async function session(token) {
    if(!tokenValid(token))return null;
    try {const s=await verifySession(token);return s && uuid(s.id) && uuid(s.sessionId) ? {id:s.id.toLowerCase(),sessionId:s.sessionId.toLowerCase()} : null;}catch{return null;}
  }
  async function active(){try{return snapshot(await readActiveDocuments(),maxBytes);}catch{return null;}}
  const sameSession=(a,b)=>a&&b&&a.id===b.id&&a.sessionId===b.sessionId;
  return {
    async issue({token}={}) {
      const before=await session(token);if(!before)return fail('verification_required');
      const docs=await active();if(!docs)return fail('documents_unavailable');
      const after=await session(token);if(!sameSession(before,after))return fail('session_changed');
      let current;try{current=readClock(now);}catch{return fail('unavailable');}
      const record={v:1,iat:current,exp:current+ttlMs,nonce:encoded(randomBytes(16)),documents:docs.metadata};
      if(!Number.isSafeInteger(record.exp))return fail('unavailable');
      const payload=encoded(JSON.stringify(record));const sig=encoded(mac(keyset.get(activeKeyId),activeKeyId,payload,before.id,before.sessionId));
      // Bodies are returned separately, never embedded in the signed receipt.
      return {ok:true,documents:{terms:docs.terms,privacy:docs.privacy,revision:docs.metadata.revision},metadata:docs.metadata,receipt:`${activeKeyId}.${payload}.${sig}`};
    },
    async verifyDocumentReceipt({receipt,token,userId,documents}={}) {
      if(typeof receipt!=='string'||receipt.length>4096||!uuid(userId)||!validMeta(documents))return false;
      const pieces=receipt.split('.');if(pieces.length!==3||!kidValid(pieces[0])||!keyset.has(pieces[0]))return false;
      const payload=decoded(pieces[1],2048),signature=decoded(pieces[2],128);
      if(!payload||!signature||signature.length!==32)return false;
      const before=await session(token);if(!before||before.id!==userId.toLowerCase())return false;
      const expected=mac(keyset.get(pieces[0]),pieces[0],pieces[1],before.id,before.sessionId);
      if(!timingSafeEqual(signature,expected))return false;
      let record;try{record=JSON.parse(payload.toString('utf8'));}catch{return false;}
      if(!exact(record,['v','iat','exp','nonce','documents'])||record.v!==1||!decoded(record.nonce,32)||decoded(record.nonce,32).length!==16||!Number.isSafeInteger(record.iat)||!Number.isSafeInteger(record.exp)||!validMeta(record.documents)||!sameMeta(record.documents,documents))return false;
      const docs=await active();if(!docs||!sameMeta(record.documents,docs.metadata))return false;
      const after=await session(token);if(!sameSession(before,after))return false;
      let current;try{current=readClock(now);}catch{return false;}
      return record.iat<=current && record.exp>current && record.exp>record.iat && record.exp-record.iat<=ttlMs;
    },
  };
}
