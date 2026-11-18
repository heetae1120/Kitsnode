// Run only against the isolated DB started by run-independent-operator.py.
// Uses actual Ed25519 verification and actual PostgreSQL role/transaction RPCs.
import assert from 'node:assert/strict';
import {createHash,createPublicKey,generateKeyPairSync,randomUUID,sign,verify} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createIndependentOperatorProofVerifier,operatorProofMessage} from '../src/independent-operator-proof.mjs';
import {createIndependentOperatorHttp} from '../src/independent-operator-http.mjs';
const sql=q=>execFileSync('psql',['-qAt','-X','-v','ON_ERROR_STOP=1','-d','postgres','-c',q],{encoding:'utf8',env:process.env,stdio:['ignore','pipe','pipe']}).trim();
const op='11111111-1111-4111-8111-111111111111',session=randomUUID(),claim=randomUUID(),id=randomUUID();
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pem=publicKey.export({format:'pem',type:'spki'}),spki=publicKey.export({format:'der',type:'spki'}).toString('base64'),fingerprint=createHash('sha256').update(publicKey.export({format:'der',type:'spki'})).digest('hex');
const sampleEvidence=Buffer.from('isolated test evidence'),evidenceHash=createHash('sha256').update(sampleEvidence).digest('hex');
const now=Date.now(),c={id,operatorId:op,sessionId:session,keyId:'key1',keyFingerprint:fingerprint,operation:'resolve',claimId:claim,expectedState:'claimed',caseRef:'CASE-123',evidenceHash,issuedAt:now,expiresAt:now+240000};
const digest=createHash('sha256').update(operatorProofMessage(c)).digest('hex');
sql(`insert into auth.users values('${op}',now(),false,null,null); insert into auth.sessions values('${session}','${op}',null); insert into kitsnode_ads_private.shadow_resolution_operators_candidate values('${op}',true); insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('${op}','key1','${fingerprint}',true,'${spki}'); insert into kitsnode_ads_private.shadow_schedule_claims values('${claim}','claimed',null,now()-interval '11 minutes',null)`);
assert.equal(sql(`set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('${claim}','CASE-123',decode('${sampleEvidence.toString('hex')}','hex'))`),evidenceHash);
const issue=sql(`set role kits_claim_resolver; select kitsnode_ads_private.issue_resolution_challenge_candidate('${id}','${op}','${session}','key1','${fingerprint}','${claim}','claimed','CASE-123','${c.evidenceHash}','${digest}',to_timestamp(${c.issuedAt}/1000.0),to_timestamp(${c.expiresAt}/1000.0))`);
assert.equal(issue,'t');
const getKey=async({operatorId,keyId})=>{const value=sql(`set role kits_claim_resolver; select kitsnode_ads_private.get_resolution_public_key_candidate('${operatorId}','${keyId}')`);return value?createPublicKey({key:Buffer.from(value,'base64'),format:'der',type:'spki'}).export({format:'pem',type:'spki'}):null};
const verifier=createIndependentOperatorProofVerifier({lookupChallenge:async challengeId=>JSON.parse(sql(`set role kits_claim_resolver; select kitsnode_ads_private.get_resolution_challenge_candidate('${challengeId}')`)),resolveKey:getKey,commitVerified:async p=>sql(`set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('${p.challengeId}','${p.claimId}','${p.expectedState}','${p.operatorId}','${p.keyId}','${p.keyFingerprint}','${p.caseRef}','${p.evidenceHash}','${p.challengeDigest}','${p.signature}')`)==='t'});
const input={verifiedUserId:op,verifiedSessionId:session,challengeId:id,signature:sign(null,operatorProofMessage(c),privateKey).toString('base64url')};
const wrong=generateKeyPairSync('ed25519');assert.equal(await verifier({...input,signature:sign(null,operatorProofMessage(c),wrong.privateKey).toString('base64url')}),false);
assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${claim}'`),'0');
assert.equal(await verifier(input),true);assert.equal(await verifier(input),false);
assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${claim}'`),'1');
assert.equal(sql(`select state from kitsnode_ads_private.shadow_schedule_claims where id='${claim}'`),'claimed');
assert.throws(()=>sql(`set role service_role; select kitsnode_ads_private.resolve_shadow_claim_candidate('${id}','${claim}','claimed','${op}','key1','${fingerprint}','CASE-123','${c.evidenceHash}','${digest}','${input.signature}')`));
// Reconstruct signed message using stored challenge and SPKI, with no live
// key registry or operator session; this proves post-hoc verification only.
const stored=JSON.parse(sql(`select json_build_object('key',c.public_key_spki,'signature',r.signature_base64url,'challenge',json_build_object('id',c.id,'operatorId',c.operator_id,'sessionId',c.session_id,'keyId',c.key_id,'keyFingerprint',c.key_fingerprint,'operation',c.operation,'claimId',c.claim_id,'expectedState',c.expected_state,'caseRef',c.case_ref,'evidenceHash',c.evidence_sha256,'issuedAt',(extract(epoch from c.issued_at)*1000)::bigint,'expiresAt',(extract(epoch from c.expires_at)*1000)::bigint)) from kitsnode_ads_private.shadow_claim_resolutions_candidate r join kitsnode_ads_private.shadow_resolution_challenges_candidate c on c.id=r.challenge_id where r.claim_id='${claim}'`));
assert.equal(verify(null,operatorProofMessage(stored.challenge),createPublicKey({key:Buffer.from(stored.key,'base64'),type:'spki',format:'der'}),Buffer.from(stored.signature,'base64url')),true);
assert.equal(verify(null,operatorProofMessage({...stored.challenge,caseRef:'CASE-CHANGED'}),createPublicKey({key:Buffer.from(stored.key,'base64'),type:'spki',format:'der'}),Buffer.from(stored.signature,'base64url')),false);
assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_resolution_key_events_candidate where operator_id='${op}' and event='registered'`),'1');
assert.throws(()=>sql(`set role kits_claim_resolver; delete from kitsnode_ads_private.shadow_resolution_key_events_candidate`));
assert.throws(()=>sql(`set role service_role; update kitsnode_ads_private.shadow_resolution_keys_candidate set active=false`));
sql(`update kitsnode_ads_private.shadow_resolution_keys_candidate set active=false where operator_id='${op}' and key_id='key1'`);
assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_resolution_key_events_candidate where operator_id='${op}' and event='revoked'`),'1');
assert.equal(verify(null,operatorProofMessage(stored.challenge),createPublicKey({key:Buffer.from(stored.key,'base64'),type:'spki',format:'der'}),Buffer.from(stored.signature,'base64url')),true);
assert.equal(await getKey({operatorId:op,keyId:'key1'}),null);
assert.throws(()=>sql(`update kitsnode_ads_private.shadow_resolution_keys_candidate set active=true where operator_id='${op}' and key_id='key1'`));
sql(`insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('${op}','key2','${fingerprint}',true,'${spki}')`);
// A second claim goes through an actual HTTP server. getUser is a deliberately
// local auth test double: no Supabase Auth service or real login is exercised.
const claim2=randomUUID();sql(`insert into kitsnode_ads_private.shadow_schedule_claims values('${claim2}','claimed',null,now()-interval '11 minutes',null)`);
const token='header.'+Buffer.from(JSON.stringify({sub:op,session_id:session,exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.signature';
const validTokens=new Set([token]);
let evidenceAvailable=true,beforeCommit=()=>{};
const app=createIndependentOperatorHttp({authClient:{auth:{getUser:async t=>validTokens.has(t)?{data:{user:{id:op,aud:'authenticated',is_anonymous:false,confirmed_at:'2026-01-01T00:00:00Z'}},error:null}:{data:{user:null},error:true}}},operatorIds:op,origin:'https://example.test',allowRequest:async()=>true,resolveKey:getKey,verifySessionActive:async({sessionId,userId})=>sql(`select exists(select 1 from auth.sessions where id='${sessionId}' and user_id='${userId}' and (not_after is null or not_after>clock_timestamp()))`)==='t',verifyEvidence:async({claimId,caseRef,evidenceHash:h})=>evidenceAvailable&&sql(`set role kits_claim_resolver; select kitsnode_ads_private.verify_resolution_evidence_candidate('${claimId}','${caseRef}','${h}')`)==='t',
 issueChallenge:async({challenge:x,challengeDigest:d})=>sql(`set role kits_claim_resolver; select kitsnode_ads_private.issue_resolution_challenge_candidate('${x.id}','${x.operatorId}','${x.sessionId}','${x.keyId}','${x.keyFingerprint}','${x.claimId}','${x.expectedState}','${x.caseRef}','${x.evidenceHash}','${d}',to_timestamp(${x.issuedAt}/1000.0),to_timestamp(${x.expiresAt}/1000.0))`)==='t',
 lookupChallenge:async challengeId=>JSON.parse(sql(`set role kits_claim_resolver; select kitsnode_ads_private.get_resolution_challenge_candidate('${challengeId}')`)),
 commitVerified:async p=>{beforeCommit();return sql(`set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('${p.challengeId}','${p.claimId}','${p.expectedState}','${p.operatorId}','${p.keyId}','${p.keyFingerprint}','${p.caseRef}','${p.evidenceHash}','${p.challengeDigest}','${p.signature}')`)==='t'}});
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request('https://example.test'+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)});const response=await app.handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text())}catch{res.writeHead(500);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const endpoint=`http://127.0.0.1:${server.address().port}/api/independent-operator-proof`;
 const request=(body,t=token,origin='https://example.test')=>fetch(endpoint,{method:'POST',headers:{origin,authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify(body)});
 const body={action:'challenge',operation:'resolve',keyId:'key2',claimId:claim2,expectedState:'claimed',caseRef:'CASE-456',evidenceHash};
 assert.equal(sql(`set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('${claim2}','CASE-456',decode('${sampleEvidence.toString('hex')}','hex'))`),evidenceHash);
 assert.equal((await request(body,'invalid')).status,401);assert.equal((await request(body,token,'https://evil.test')).status,403);
 assert.equal((await request({...body,evidenceHash:'d'.repeat(64)})).status,409);
 assert.equal((await request({...body,caseRef:'CASE-OTHER'})).status,409);
 const issued=await request(body);assert.equal(issued.status,201);const x=(await issued.json()).challenge;
 const signature=sign(null,operatorProofMessage(x),privateKey).toString('base64url');
 evidenceAvailable=false;assert.equal((await request({action:'submit',challengeId:x.id,signature})).status,409);evidenceAvailable=true;
 const submitted=await request({action:'submit',challengeId:x.id,signature});assert.equal(submitted.status,201);
 assert.equal((await request({action:'submit',challengeId:x.id,signature})).status,409);
 assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${claim2}'`),'1');
 const expiryClaim=randomUUID();sql(`insert into kitsnode_ads_private.shadow_schedule_claims values('${expiryClaim}','claimed',null,now()-interval '11 minutes',null)`);assert.equal(sql(`set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('${expiryClaim}','CASE-456',decode('${sampleEvidence.toString('hex')}','hex'))`),evidenceHash);
 const shortToken='header.'+Buffer.from(JSON.stringify({sub:op,session_id:session,exp:Math.floor(Date.now()/1000)+2})).toString('base64url')+'.signature';validTokens.add(shortToken);
 const expIssue=await request({...body,claimId:expiryClaim},shortToken);assert.equal(expIssue.status,201);const expChallenge=(await expIssue.json()).challenge;
 const expSignature=sign(null,operatorProofMessage(expChallenge),privateKey).toString('base64url');beforeCommit=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2500);
 assert.equal((await request({action:'submit',challengeId:expChallenge.id,signature:expSignature},shortToken)).status,409);beforeCommit=()=>{};
 assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${expiryClaim}'`),'0');
 // Authentication/revocation changes made just before DB commit are checked
 // again inside the same locked resolver transaction, not only by HTTP.
 for(const scenario of ['session','operator','ban','evidence','key']){
  const target=randomUUID();sql(`insert into kitsnode_ads_private.shadow_schedule_claims values('${target}','claimed',null,now()-interval '11 minutes',null)`);assert.equal(sql(`set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('${target}','CASE-456',decode('${sampleEvidence.toString('hex')}','hex'))`),evidenceHash);
  const response=await request({...body,claimId:target});assert.equal(response.status,201);const y=(await response.json()).challenge;
  const signed=sign(null,operatorProofMessage(y),privateKey).toString('base64url');
  beforeCommit=()=>{
   if(scenario==='session')sql(`delete from auth.sessions where id='${session}'`);
   if(scenario==='operator')sql(`update kitsnode_ads_private.shadow_resolution_operators_candidate set active=false where operator_id='${op}'`);
   if(scenario==='ban')sql(`update auth.users set banned_until=now()+interval '1 hour' where id='${op}'`);
   if(scenario==='evidence')sql(`update kitsnode_ads_private.shadow_resolution_evidence_candidate set active=false where claim_id='${target}'`);
   if(scenario==='key')sql(`update kitsnode_ads_private.shadow_resolution_keys_candidate set active=false where operator_id='${op}' and key_id='key2'`);
  };
  assert.equal((await request({action:'submit',challengeId:y.id,signature:signed})).status,409);beforeCommit=()=>{};
  assert.equal(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${target}'`),'0');
  if(scenario==='session')sql(`insert into auth.sessions values('${session}','${op}',null)`);
  if(scenario==='operator')sql(`update kitsnode_ads_private.shadow_resolution_operators_candidate set active=true where operator_id='${op}'`);
  if(scenario==='ban')sql(`update auth.users set banned_until=null where id='${op}'`);
 }
}finally{await new Promise(resolve=>server.close(resolve))}
console.log('isolated HTTP auth double → signed challenge → real DB role → atomic single-use resolution verified');
