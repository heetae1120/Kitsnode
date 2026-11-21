import test from 'node:test';import assert from 'node:assert/strict';import {createHmac,randomUUID} from 'node:crypto';
import {createExecutionProofHandler} from '../supabase/functions/kitsnode-ad-consent-proof/factory.mjs';
import {createConsentProof} from '../supabase/functions/kitsnode-ad-consent-api/consent-proof-bridge.mjs';
import {startProofProxy} from './invite-proof-local-proxy.mjs';
const auth=process.env.KITS_TEST_AUTH_URL,rest=process.env.KITS_TEST_REST_URL,secret=process.env.KITS_TEST_JWT_SECRET;
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function serviceToken(){const body=`${b64({alg:'HS256',typ:'JWT'})}.${b64({role:'service_role',iss:'local-test',exp:Math.floor(Date.now()/1000)+600})}`;return body+'.'+createHmac('sha256',secret).update(body).digest('base64url')}
function rpcWith(key){return async(name,args={})=>{try{const r=await fetch(`${rest}/rpc/${name}`,{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(args)});const data=await r.json();return r.ok?{data,error:null}:{data:null,error:{status:r.status}}}catch{return {data:null,error:{status:0}}}}}
test('real GoTrue JWT, PostgREST and Postgres bind one invitation attempt without granting access',{skip:!auth||!rest||!secret,timeout:30000},async t=>{
 const signup=await fetch(`${auth}/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`invite-${randomUUID()}@example.test`,password:'SyntheticOnly-123456!'})});assert.equal(signup.status,200);const logged=await signup.json(),token=logged.access_token,userId=logged.user?.id;assert.ok(token&&userId);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()),serviceClient={rpc:rpcWith(serviceToken())};
 const setup=await serviceClient.rpc('kits_test_connection',{p_id:randomUUID(),p_user:userId,p_account:'123'});assert.equal(setup.error,null);
 const consentId=randomUUID(),saved=await serviceClient.rpc('kits_invite_record',{p_id:consentId,p_user:userId,p_session:claims.session_id,p_account:'123',p_version:'v1',p_digest:'a'.repeat(64)});assert.equal(saved.data,consentId);
 const authClient={auth:{async getUser(bearer){try{const response=await fetch(`${auth}/user`,{headers:{authorization:`Bearer ${bearer}`}});return response.ok?{data:{user:await response.json()},error:null}:{data:null,error:true}}catch{return {data:null,error:true}}}}};
 const extension='abcdefghijklmnopabcdefghijklmnop',handler=createExecutionProofHandler({authClient,serviceClient,extensionId:extension,consentVersion:'v1',consentDigest:'a'.repeat(64)});const site='https://heetae1120.github.io';
 const proxy=await startProofProxy(handler);t.after(proxy.close);
 const extensionProof=process.env.KITS_TEST_EXTENSION?await import(process.env.KITS_TEST_EXTENSION):{createConsentProof};
 const proof=await extensionProof.createConsentProof({consentId,accountId:'123',viewerId:'advertiser',consentVersion:'v1',consentDigest:'sha256:'+'a'.repeat(64),naverPolicyVersion:'nav-invite-2026-11-21-v1',naverPolicyDigest:'sha256:c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596'});
 const invoke=async(path,origin,body,bearer)=>handler(new Request('https://local.test/kitsnode-ad-consent-proof/proof/'+path,{method:'POST',headers:{origin,'content-type':'application/json',...(bearer?{authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(body)}));
 assert.equal((await invoke('approve',site,{consentId,request:proof.request},token)).status,403);
 const otherSignup=await fetch(`${auth}/signup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`other-${randomUUID()}@example.test`,password:'SyntheticOnly-123456!'})});assert.equal(otherSignup.status,200);const other=await otherSignup.json();
 const policy={consentId,naverPolicyVersion:'nav-invite-2026-11-21-v1',naverPolicyDigest:'sha256:c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596'};
 const confirmFor=(actor,body=policy)=>handler(new Request('https://local.test/kitsnode-ad-consent-proof/policy-confirm',{method:'POST',headers:{origin:site,'content-type':'application/json',authorization:`Bearer ${actor}`},body:JSON.stringify(body)}));
 assert.equal((await confirmFor(other.access_token)).status,403);assert.equal((await confirmFor(token,{...policy,naverPolicyVersion:'wrong'})).status,400);
 const {confirmNaverInvitePolicy}=await import('./fixtures/invite-web/naver-invite-policy-client.mjs');
 const {approveInviteProofCandidate}=await import('./fixtures/invite-web/invite-proof-web-candidate.mjs');
 const localFetch=(url,init)=>{const source=new URL(url),suffix=source.pathname.split('/kitsnode-ad-consent-proof')[1];return fetch(`${proxy.url}/kitsnode-ad-consent-proof${suffix}`,{...init,headers:{...init.headers,origin:site}});};
 assert.equal(await confirmNaverInvitePolicy({token,consentId,signal:new AbortController().signal,fetcher:localFetch}),true);
 const newer=createExecutionProofHandler({authClient,serviceClient,extensionId:extension,consentVersion:'v2',consentDigest:'a'.repeat(64)});
 const staleRequest=new Request('https://local.test/kitsnode-ad-consent-proof/proof/approve',{method:'POST',headers:{origin:site,'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({consentId,request:proof.request})});assert.equal((await newer(staleRequest)).status,403,'old published consent cannot authorize a new version');
 assert.equal((await confirmFor(token)).status,200, 'identical retry after response loss is safe');
 const messages=[];const runtime={async sendMessage(_id,message){messages.push(message);if(message.type==='kitsnode.proof.start.v2')return {status:'started'};if(message.type==='kitsnode.proof.prepare.v2')return {status:'ready',request:proof.request};if(message.type==='kitsnode.proof.approved.v2')return {status:'signalled'};return {status:'blocked'}}};
 const webResult=await approveInviteProofCandidate({consentId,accountId:'123',consentVersion:'v1',policyDigest:'a'.repeat(64),nonce:randomUUID(),extension,runtime,getSession:async()=>({data:{session:{user:{id:userId},access_token:token}}}),isCurrent:id=>id===userId,userId,signal:new AbortController().signal,fetcher:localFetch});
 assert.deepEqual(webResult,{status:'approved'});assert.equal(JSON.stringify(messages).includes(token),false);

 const signed=path=>async body=>(await invoke(path,`chrome-extension://${extension}`,body)).json();assert.equal(await proof.redeem(signed('redeem')),true);assert.equal(await proof.beginSend(signed('begin')),true);assert.equal(await proof.beginSend(signed('begin')),false);assert.equal((await confirmFor(token)).status,403, 'consumed consent cannot be reconfirmed');
 const state=await serviceClient.rpc('kits_ads_list',{p_user_id:userId});assert.equal(state.data[0].status,'pending_review');
 const untrusted=await rpcWith(token)('kits_invite_proof_get_candidate',{p_request:proof.request.requestId});assert.notEqual(untrusted.error,null);
});
