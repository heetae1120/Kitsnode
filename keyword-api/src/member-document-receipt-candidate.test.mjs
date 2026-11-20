import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMemberDocumentReceiptCandidate} from './member-document-receipt-candidate.mjs';
import {createAtomicCompletionServiceCandidate} from './member-atomic-completion-service-candidate.mjs';

const uid='00000000-0000-4000-8000-000000000001', uid2='00000000-0000-4000-8000-000000000002';
const sid='10000000-0000-4000-8000-000000000001', sid2='10000000-0000-4000-8000-000000000002';
const bytes=text=>Buffer.from(text,'utf8'), digest=buffer=>createHash('sha256').update(buffer).digest('hex');
function fixture(options={}) {
 let clock=1700000000000,active={terms:{version:'t1',bytes:bytes('이용약관 본문')},privacy:{version:'p1',bytes:bytes('개인정보 본문')},revision:1},user={id:uid,sessionId:sid};
 const old=Buffer.alloc(32,1),fresh=Buffer.alloc(32,2);
 const config={verifySession:async()=>user,readActiveDocuments:async()=>active,keys:{old},activeKeyId:'old',now:()=>clock,ttlMs:60000,...options};
 const svc=createMemberDocumentReceiptCandidate(config);
 return {svc,config,old,fresh,setClock:value=>{clock=value},setActive:value=>{active=value},getActive:()=>active,setUser:value=>{user=value}};
}
const verify=(f,issued,overrides={})=>f.svc.verifyDocumentReceipt({receipt:issued.receipt,token:'synthetic-token',userId:uid,documents:issued.metadata,...overrides});

test('documents are hashed from exact lossless UTF-8 bytes; receipt excludes body, IDs and token',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'});assert.equal(out.ok,true);
 assert.equal(out.documents.terms.body,'이용약관 본문');assert.equal(out.metadata.termsSha256,digest(bytes('이용약관 본문')));
 assert.equal(out.metadata.privacySha256,digest(bytes('개인정보 본문')));assert.equal(await verify(f,out),true);
 const payload=Buffer.from(out.receipt.split('.')[1],'base64url').toString('utf8');
 for(const secret of ['이용약관 본문','개인정보 본문',uid,sid,'synthetic-token','@'])assert.equal(payload.includes(secret),false);
 const second=await f.svc.issue({token:'synthetic-token'});assert.notEqual(second.receipt,out.receipt); // random nonce, no stable cross-issuance tag
});
test('receipt is bound to verified user and session, not supplied identity',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'});
 assert.equal(await verify(f,out,{userId:uid2}),false);
 f.setUser({id:uid2,sessionId:sid});assert.equal(await verify(f,out,{userId:uid2}),false);
 f.setUser({id:uid,sessionId:sid2});assert.equal(await verify(f,out),false);
 f.setUser(null);assert.equal(await verify(f,out),false);
});
test('expired receipts and backwards/invalid clocks fail closed',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'});
 f.setClock(1700000059999);assert.equal(await verify(f,out),true);
 f.setClock(1700000060000);assert.equal(await verify(f,out),false);
 f.setClock(1699999999999);assert.equal(await verify(f,out),false);
 f.setClock(Number.NaN);assert.equal(await verify(f,out),false);assert.equal((await f.svc.issue({token:'synthetic-token'})).code,'unavailable');
});
test('rejects tampered receipt, forged bytes, wrong key and malformed payloads',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'}),parts=out.receipt.split('.');
 const parsed=JSON.parse(Buffer.from(parts[1],'base64url').toString());parsed.documents.revision=2;
 assert.equal(await verify(f,out,{receipt:`${parts[0]}.${Buffer.from(JSON.stringify(parsed)).toString('base64url')}.${parts[2]}`}),false);
 assert.equal(await verify(f,out,{receipt:`${parts[0]}.${parts[1]}.${parts[2].slice(0,-1)}A`}),false);
 for(const receipt of ['',out.receipt+'.junk','x'.repeat(5000),'old.*.x','old.a.x','old....'])assert.equal(await verify(f,out,{receipt}),false);
 assert.equal(await verify(f,out,{documents:{...out.metadata,termsSha256:'c'.repeat(64)}}),false);
});
test('same-version content update, revision update and inactive sources invalidate earlier receipt',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'}),base=f.getActive();
 for(const next of [{...base,terms:{...base.terms,bytes:bytes('바뀐 내용')}},{...base,revision:2},{...base,privacy:{...base.privacy,version:'p2'}},null]) {
  f.setActive(next);assert.equal(await verify(f,out),false);
 }
});
test('rotated keys verify only while prior key is retained and current key issues new receipts',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'});
 const retained=createMemberDocumentReceiptCandidate({...f.config,keys:{old:f.old,new:f.fresh},activeKeyId:'new'});
 assert.equal(await retained.verifyDocumentReceipt({receipt:out.receipt,token:'synthetic-token',userId:uid,documents:out.metadata}),true);
 const newer=await retained.issue({token:'synthetic-token'});assert.ok(newer.receipt.startsWith('new.'));
 const removed=createMemberDocumentReceiptCandidate({...f.config,keys:{new:f.fresh},activeKeyId:'new'});
 assert.equal(await removed.verifyDocumentReceipt({receipt:out.receipt,token:'synthetic-token',userId:uid,documents:out.metadata}),false);
});
test('unavailable, invalid, empty, over-limit and invalid UTF-8 documents never yield a receipt',async()=>{
 const bad=[null,{terms:{version:'t1',bytes:Buffer.from([0xff])},privacy:{version:'p1',bytes:bytes('p')},revision:1},
 {terms:{version:'t1',bytes:Buffer.from([0xef,0xbb,0xbf,0x61])},privacy:{version:'p1',bytes:bytes('p')},revision:1},
 {terms:{version:'t1',bytes:bytes('')},privacy:{version:'p1',bytes:bytes('p')},revision:1},
 {terms:{version:'t1',bytes:bytes('a\0b')},privacy:{version:'p1',bytes:bytes('p')},revision:1},
 {terms:{version:'t1',bytes:bytes('too long')},privacy:{version:'p1',bytes:bytes('p')},revision:1}];
 for(const value of bad){const f=fixture({readActiveDocuments:async()=>value,maxBytes:4});assert.deepEqual(await f.svc.issue({token:'synthetic-token'}),{ok:false,code:'documents_unavailable'});}
 const f=fixture({readActiveDocuments:async()=>{throw Error('offline')}});assert.deepEqual(await f.svc.issue({token:'synthetic-token'}),{ok:false,code:'documents_unavailable'});
});
test('session changes or verifier failure during document read prevent receipt issuance',async()=>{
 let count=0;const f=fixture({verifySession:async()=>++count===1?{id:uid,sessionId:sid}:{id:uid2,sessionId:sid2}});
 assert.deepEqual(await f.svc.issue({token:'synthetic-token'}),{ok:false,code:'session_changed'});
 const denied=fixture({verifySession:async()=>{throw Error('revoked')}});assert.deepEqual(await denied.svc.issue({token:'synthetic-token'}),{ok:false,code:'verification_required'});
});
test('session change during verification and forged metadata types are refused',async()=>{
 const f=fixture(),out=await f.svc.issue({token:'synthetic-token'});
 let calls=0;const changed=createMemberDocumentReceiptCandidate({...f.config,verifySession:async()=>++calls===1?{id:uid,sessionId:sid}:{id:uid,sessionId:sid2}});
 assert.equal(await changed.verifyDocumentReceipt({receipt:out.receipt,token:'synthetic-token',userId:uid,documents:out.metadata}),false);
 assert.equal(await verify(f,out,{documents:{...out.metadata,termsSha256:[out.metadata.termsSha256]}}),false);
});
test('bad keys, origin-independent arguments and invalid dependencies fail at construction',()=>{
 const f=fixture();for(const change of [{verifySession:null},{readActiveDocuments:null},{keys:{old:Buffer.alloc(31)}},{activeKeyId:'missing'},{ttlMs:0},{ttlMs:900001}])assert.throws(()=>createMemberDocumentReceiptCandidate({...f.config,...change}),TypeError);
});
test('issued document snapshot composes with atomic service and rejects later change or another session',async()=>{
 const f=fixture(),issued=await f.svc.issue({token:'synthetic-token'});let calls=0;
 const readActiveDocuments=async()=>{const d=f.getActive();return {termsVersion:d.terms.version,privacyVersion:d.privacy.version,termsSha256:digest(d.terms.bytes),privacySha256:digest(d.privacy.bytes),revision:d.revision};};
 const service=createAtomicCompletionServiceCandidate({readActiveDocuments,
  verifySession:async()=>({id:uid,email:'sample@example.test',emailConfirmed:true,emailProvider:true}),
  verifyDocumentReceipt:f.svc.verifyDocumentReceipt,
  atomicAdapter:{contract:'member-atomic-completion-v1',complete:async payload=>{calls++;assert.deepEqual(payload.documents,issued.metadata);return 'created';}}});
 const input={name:'홍길동',username:'seller',email:'sample@example.test',phone:'01012345678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:issued.metadata.termsVersion,privacyVersion:issued.metadata.privacyVersion};
 const request={token:'synthetic-token',input,documents:issued.metadata,documentReceipt:issued.receipt};
 assert.deepEqual(await service.complete(request),{ok:true,code:'profile_completed'});assert.equal(calls,1);
 const original=f.getActive();f.setActive({...original,terms:{...original.terms,bytes:bytes('다른 약관')}});
 assert.deepEqual(await service.complete(request),{ok:false,code:'document_unverified'});assert.equal(calls,1);
 f.setActive(original);f.setUser({id:uid,sessionId:sid2});
 assert.deepEqual(await service.complete(request),{ok:false,code:'document_unverified'});assert.equal(calls,1);
});
