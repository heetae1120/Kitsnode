// Explicit test harness: real temporary Supabase Auth user/JWT, isolated local
// Postgres copy of that user/session, locally generated operator proof key.
// This does not deploy or validate an independent production auth service.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID,generateKeyPairSync,createHash,sign,createPublicKey} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createClient} from '@supabase/supabase-js';
import {createIndependentOperatorHttp} from '../src/independent-operator-http.mjs';
import {operatorProofMessage} from '../src/independent-operator-proof.mjs';
const key=readFileSync(0,'utf8').trim(),url='https://bjpguxwqxlsteektkhwf.supabase.co';
if(!key)throw Error('missing secret');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),member=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const recovery=join(homedir(),'.kits-shadow-auth-integration-recovery.json'),marker=randomUUID(),email=`kits-shadow-${marker}@example.invalid`,password=randomBytes(32).toString('base64url');
const sql=q=>execFileSync('psql',['-qAt','-X','-v','ON_ERROR_STOP=1','-d','postgres','-c',q],{encoding:'utf8',env:process.env,stdio:['ignore','pipe','pipe']}).trim();
let id=null,failed=false,cleaned=false,server;
writeFileSync(recovery,JSON.stringify({marker,email,userId:null}),{mode:0o600,flag:'wx'});
try{
 const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{kitsShadowTestMarker:marker}});if(made.error||!made.data?.user?.id)throw Error();
 id=made.data.user.id;writeFileSync(recovery,JSON.stringify({marker,email,userId:id}),{mode:0o600});
 const login=await member.auth.signInWithPassword({email,password});if(login.error||!login.data?.session?.access_token)throw Error();
 const token=login.data.session.access_token,claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')),session=claims.session_id;
 if(claims.sub!==id||!/^[0-9a-f-]{36}$/i.test(session||''))throw Error();
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'),spki=publicKey.export({format:'der',type:'spki'}).toString('base64'),fingerprint=createHash('sha256').update(Buffer.from(spki,'base64')).digest('hex');
 const content=Buffer.from('isolated-evidence'),hash=createHash('sha256').update(content).digest('hex'),target=randomUUID(),target2=randomUUID();
 sql(`insert into auth.users values('${id}',now(),false,null,null); insert into auth.sessions values('${session}','${id}',null); insert into kitsnode_ads_private.shadow_resolution_operators_candidate values('${id}',true); insert into kitsnode_ads_private.shadow_resolution_keys_candidate values('${id}','test-key','${fingerprint}',true,'${spki}'); insert into kitsnode_ads_private.shadow_schedule_claims values('${target}','claimed',null,now()-interval '11 minutes',null),('${target2}','claimed',null,now()-interval '11 minutes',null)`);
 for(const claim of [target,target2])if(sql(`set role kits_evidence_registrar; select kitsnode_ads_private.register_resolution_evidence_candidate('${claim}','CASE-TEST',decode('${content.toString('hex')}','hex'))`)!==hash)throw Error();
 const app=createIndependentOperatorHttp({authClient:admin,operatorIds:id,origin:'https://example.test',allowRequest:async()=>true,
  resolveKey:async({operatorId,keyId})=>{const v=sql(`set role kits_claim_resolver; select kitsnode_ads_private.get_resolution_public_key_candidate('${operatorId}','${keyId}')`);return v?createPublicKey({key:Buffer.from(v,'base64'),type:'spki',format:'der'}).export({type:'spki',format:'pem'}):null},
  verifySessionActive:async({sessionId,userId})=>sql(`select exists(select 1 from auth.sessions where id='${sessionId}' and user_id='${userId}')`)==='t',
  verifyEvidence:async({claimId,caseRef,evidenceHash})=>sql(`set role kits_claim_resolver; select kitsnode_ads_private.verify_resolution_evidence_candidate('${claimId}','${caseRef}','${evidenceHash}')`)==='t',
  issueChallenge:async({challenge:x,challengeDigest:d})=>sql(`set role kits_claim_resolver; select kitsnode_ads_private.issue_resolution_challenge_candidate('${x.id}','${x.operatorId}','${x.sessionId}','${x.keyId}','${x.keyFingerprint}','${x.claimId}','${x.expectedState}','${x.caseRef}','${x.evidenceHash}','${d}',to_timestamp(${x.issuedAt}/1000.0),to_timestamp(${x.expiresAt}/1000.0))`)==='t',
  lookupChallenge:async challengeId=>JSON.parse(sql(`set role kits_claim_resolver; select kitsnode_ads_private.get_resolution_challenge_candidate('${challengeId}')`)),
  commitVerified:async p=>sql(`set role kits_claim_resolver; select kitsnode_ads_private.resolve_shadow_claim_candidate('${p.challengeId}','${p.claimId}','${p.expectedState}','${p.operatorId}','${p.keyId}','${p.keyFingerprint}','${p.caseRef}','${p.evidenceHash}','${p.challengeDigest}','${p.signature}')`)==='t'});
 server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await app.handler(new Request('https://example.test'+req.url,{method:req.method,headers:req.headers,body:Buffer.concat(chunks)}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text())}catch{res.writeHead(500);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const endpoint=`http://127.0.0.1:${server.address().port}/api/independent-operator-proof`;
 const request=body=>fetch(endpoint,{method:'POST',headers:{origin:'https://example.test',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});
 async function issue(claimId){const r=await request({action:'challenge',operation:'resolve',keyId:'test-key',claimId,expectedState:'claimed',caseRef:'CASE-TEST',evidenceHash:hash});if(r.status!==201)throw Error();const x=(await r.json()).challenge;return {action:'submit',challengeId:x.id,signature:sign(null,operatorProofMessage(x),privateKey).toString('base64url')}}
 const proof=await issue(target),pending=await issue(target2);if((await request(proof)).status!==201||(await request(proof)).status!==409)throw Error();
 const out=await member.auth.signOut({scope:'global'});if(out.error||(await request(pending)).status!==401)throw Error();
 if(sql(`select count(*) from kitsnode_ads_private.shadow_claim_resolutions_candidate where claim_id='${target2}'`)!=='0')throw Error();
 console.log('real-auth-jwt-http-signature-local-db-and-revocation-verified');
}catch{failed=true;console.log('real-auth-integration-failed');}
finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 if(!id){try{for(let page=1;page<=100;page++){const r=await admin.auth.admin.listUsers({page,perPage:1000});if(r.error)throw Error();const u=r.data?.users||[],found=u.filter(v=>v.email===email&&v.user_metadata?.kitsShadowTestMarker===marker);if(found.length>1)throw Error();if(found.length===1){id=found[0].id;break}if(u.length<1000)break}}catch{failed=true}}
 if(id){try{const d=await admin.auth.admin.deleteUser(id);if(d.error)throw Error();const r=await admin.auth.admin.getUserById(id);if((r.error&&r.error.status!==404)||(!r.error&&r.data?.user))throw Error();cleaned=true}catch{failed=true}}else cleaned=!failed;
 if(cleaned){try{unlinkSync(recovery)}catch{failed=true}console.log('synthetic-user-cleanup-confirmed')}else console.log('cleanup-required-reference='+recovery);
 if(failed)process.exitCode=1;
}
