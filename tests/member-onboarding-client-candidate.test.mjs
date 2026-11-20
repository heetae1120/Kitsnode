import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberOnboardingClientCandidate} from '../src/lib/member-onboarding-client-candidate.mjs';

const draftA='a'.repeat(64),draftB='b'.repeat(64);
const response = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'content-type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function harness({fetchImpl,failStorage=false,snapshotImpl}={}) {
 const map=new Map(),events=[];let generation=0,token='verified-token';
 const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>{if(failStorage)throw Error('blocked');map.set(k,v)},removeItem:k=>map.delete(k)};
 const sessionBridge={snapshot:snapshotImpl||(()=>({generation,accessToken:token})),isCurrent:s=>s.generation===generation,installIfCurrent:async (session,s)=>{if(s.generation!==generation)return false;events.push(['install',session]);generation++;return true},signOut:async()=>{generation++;token=''},revokeIssuedSession:async s=>events.push(['revoke',s]),change:()=>generation++};
 const client=createMemberOnboardingClientCandidate({apiOrigin:'https://api.example.test',expectedApiOrigin:'https://api.example.test',fetchImpl:fetchImpl|| (async()=>response({ok:true,code:'signup_requested',draft:draftA})),storage,sessionBridge});
 return {client,map,events,sessionBridge};
}
const getSaved=map=>[...map.values()][0];

test('fixed origin, credential-free fetch, and only encrypted draft stored',async()=>{
 let request;const h=harness({fetchImpl:async(url,opts)=>{request={url,opts};return response({ok:true,code:'signup_requested',draft:draftA})}});
 assert.deepEqual(await h.client.register({username:'seller',password:'sample-secret',email:'seller@example.test'}),{ok:true,code:'signup_requested'});
 assert.equal(getSaved(h.map),draftA);assert.equal(JSON.stringify([...h.map]).includes('sample-secret'),false);assert.equal(JSON.stringify([...h.map]).includes('seller@example.test'),false);
 assert.equal(request.url,'https://api.example.test/member/onboarding/register');assert.equal(request.opts.credentials,'omit');assert.equal(request.opts.redirect,'error');
 assert.throws(()=>createMemberOnboardingClientCandidate({apiOrigin:'https://attacker.example',expectedApiOrigin:'https://api.example.test'}),/invalid_origin/);
});
test('unavailable storage or other device yields explicit manual completion',async()=>{
 const bad=harness({failStorage:true});assert.deepEqual(await bad.client.register({}),{ok:true,code:'signup_requested_manual'});
 assert.deepEqual(await bad.client.inspectDraft(),{ok:false,code:'manual_completion_required'});
 const fresh=harness();assert.deepEqual(await fresh.client.inspectDraft(),{ok:false,code:'manual_completion_required'});
});
test('late signup response cannot restore a draft after sign out',async()=>{
 const pending=deferred();const h=harness({fetchImpl:()=>pending.promise});
 const started=h.client.register({});await new Promise(r=>setImmediate(r));await h.client.signOut();pending.resolve(response({ok:true,code:'signup_requested',draft:draftA}));
 assert.deepEqual(await started,{ok:false,code:'session_changed'});assert.equal(h.map.size,0);
});
test('older delayed session snapshot cannot erase a newer signup draft',async()=>{
 const capture=deferred();let snapshots=0,requests=0;
 const h=harness({snapshotImpl:()=>++snapshots===1?capture.promise:{generation:0,accessToken:'verified-token'},fetchImpl:async()=>response({ok:true,code:'signup_requested',draft:++requests===1?draftB:draftA})});
 const old=h.client.register({username:'older'});await new Promise(r=>setImmediate(r));
 assert.deepEqual(await h.client.register({username:'newer'}),{ok:true,code:'signup_requested'});assert.equal(getSaved(h.map),draftB);
 capture.resolve({generation:0,accessToken:'verified-token'});
 assert.deepEqual(await old,{ok:false,code:'session_changed'});assert.equal(getSaved(h.map),draftB);assert.equal(requests,1);
});
test('late profile completion cannot clear a newer draft or finish another session',async()=>{
 const pending=deferred();const h=harness({fetchImpl:async url=>url.endsWith('/complete')?pending.promise:response({ok:true,code:'signup_requested',draft:draftA})});
 await h.client.register({});const completion=h.client.complete({});await new Promise(r=>setImmediate(r));
 h.sessionBridge.change();pending.resolve(response({ok:true,code:'profile_completed'}));
 assert.deepEqual(await completion,{ok:false,code:'session_changed'});assert.equal(getSaved(h.map),draftA);
});
test('issued session rejected after session change is revoked rather than installed',async()=>{
 const pending=deferred();const h=harness({fetchImpl:()=>pending.promise});const attempt=h.client.signIn('seller','secret');await new Promise(r=>setImmediate(r));h.sessionBridge.change();
 const issued={access_token:'access-token',refresh_token:'refresh-token'};pending.resolve(response({ok:true,code:'signed_in',session:issued}));
 assert.deepEqual(await attempt,{ok:false,code:'session_changed'});assert.deepEqual(h.events,[['revoke',issued]]);
});
test('network failures are not misreported as successful registration',async()=>{
 const h=harness({fetchImpl:async()=>{throw Error('offline')}});assert.deepEqual(await h.client.register({}),{ok:false,code:'unavailable'});assert.equal(h.map.size,0);
});
test('a completed manual recovery clears the previously stored draft',async()=>{
 const h=harness({fetchImpl:async url=>url.endsWith('/register')?response({ok:true,code:'signup_requested',draft:draftA}):response({ok:true,code:'profile_completed'})});
 await h.client.register({});assert.equal(getSaved(h.map),draftA);
 assert.deepEqual(await h.client.completeManual({}),{ok:true,code:'profile_completed'});assert.equal(h.map.size,0);
});
test('expired draft is discarded when server requires manual recovery',async()=>{
 const h=harness({fetchImpl:async url=>url.endsWith('/register')?response({ok:true,code:'signup_requested',draft:draftA}):response({ok:false,code:'verification_required'})});
 await h.client.register({});assert.deepEqual(await h.client.inspectDraft(),{ok:false,code:'manual_completion_required'});assert.equal(h.map.size,0);
});
test('unexpected incomplete issued session is discarded and revoked',async()=>{
 const partial={access_token:'access-token'};const h=harness({fetchImpl:async()=>response({ok:true,code:'signed_in',session:partial})});
 assert.deepEqual(await h.client.signIn('seller','secret'),{ok:false,code:'unavailable'});assert.deepEqual(h.events,[['revoke',partial]]);
});
test('an earlier failed registration does not destroy a recoverable draft',async()=>{
 let count=0;const h=harness({fetchImpl:async()=>{if(++count===1)return response({ok:true,code:'signup_requested',draft:draftA});throw Error('offline')}});
 await h.client.register({});assert.deepEqual(await h.client.register({}),{ok:false,code:'unavailable'});assert.equal(getSaved(h.map),draftA);
});
test('late manual completion preserves a newer registration draft',async()=>{
 const pending=deferred();let count=0;
 const h=harness({fetchImpl:async url=>url.endsWith('/complete-manual')?pending.promise:response({ok:true,code:'signup_requested',draft:++count===1?draftA:draftB})});
 await h.client.register({});const completion=h.client.completeManual({});await new Promise(r=>setImmediate(r));await h.client.register({});
 pending.resolve(response({ok:true,code:'profile_completed'}));assert.deepEqual(await completion,{ok:true,code:'profile_completed'});assert.equal(getSaved(h.map),draftB);
});
test('invalid oversized response is rejected without storing sensitive data',async()=>{
 const h=harness({fetchImpl:async()=>new Response('x'.repeat(16385),{status:200})});assert.deepEqual(await h.client.register({password:'secret'}),{ok:false,code:'unavailable'});assert.equal(h.map.size,0);
});
test('a successful login installs tokens only through the session coordinator',async()=>{
 const issued={access_token:'new-access',refresh_token:'new-refresh'};const h=harness({fetchImpl:async()=>response({ok:true,code:'signed_in',session:issued})});
 assert.deepEqual(await h.client.signIn('seller','secret'),{ok:true,code:'signed_in'});assert.deepEqual(h.events,[['install',issued]]);
});
test('a login response arriving after signout starts is never installed',async()=>{
 const pendingLogin=deferred(),pendingSignOut=deferred();const h=harness({fetchImpl:()=>pendingLogin.promise});
 h.sessionBridge.signOut=()=>pendingSignOut.promise;
 const login=h.client.signIn('seller','secret');await new Promise(r=>setImmediate(r));const logout=h.client.signOut();
 const issued={access_token:'old-access',refresh_token:'old-refresh'};pendingLogin.resolve(response({ok:true,code:'signed_in',session:issued}));
 assert.deepEqual(await login,{ok:false,code:'session_changed'});assert.deepEqual(h.events,[['revoke',issued]]);pendingSignOut.resolve();await logout;
});

for (const method of ['inspectDraft','complete','completeManual']) {
 test(`${method} response arriving after signout starts is ignored`,async()=>{
  const pending=deferred(),pendingSignOut=deferred();
  const h=harness({fetchImpl:async url=>url.endsWith('/register')?response({ok:true,code:'signup_requested',draft:draftA}):pending.promise});
  await h.client.register({});
  h.sessionBridge.signOut=()=>pendingSignOut.promise;
  const operation=method==='inspectDraft'?h.client.inspectDraft():method==='complete'?h.client.complete({}):h.client.completeManual({});
  await new Promise(r=>setImmediate(r));const logout=h.client.signOut();
  pending.resolve(response(method==='inspectDraft'?{ok:true,code:'draft_ready',fields:{name:'private'}}:{ok:true,code:'profile_completed'}));
  assert.deepEqual(await operation,{ok:false,code:'session_changed'});
  pendingSignOut.resolve();await logout;
 });
}

for (const method of ['inspectDraft','complete','completeManual']) {
 test(`${method} does not start a request when signout begins during session snapshot`,async()=>{
  const pendingSnapshot=deferred(),pendingSignOut=deferred();let snapshots=0,requests=0;
  const h=harness({snapshotImpl:()=>++snapshots===1?{generation:0,accessToken:'verified-token'}:pendingSnapshot.promise,
    fetchImpl:async()=>{requests++;return response({ok:true,code:'signup_requested',draft:draftA});}});
  await h.client.register({});h.sessionBridge.signOut=()=>pendingSignOut.promise;
  const operation=method==='inspectDraft'?h.client.inspectDraft():method==='complete'?h.client.complete({}):h.client.completeManual({});
  await new Promise(r=>setImmediate(r));const logout=h.client.signOut();
  pendingSnapshot.resolve({generation:0,accessToken:'verified-token'});
  assert.deepEqual(await operation,{ok:false,code:'session_changed'});assert.equal(requests,1);
  pendingSignOut.resolve();await logout;
 });
}

for (const method of ['inspectDraft','complete','completeManual']) {
 test(`${method} ignores a response after an external signed-out notification`,async()=>{
  const pending=deferred();const h=harness({fetchImpl:async url=>url.endsWith('/register')?response({ok:true,code:'signup_requested',draft:draftA}):pending.promise});
  await h.client.register({});
  const operation=method==='inspectDraft'?h.client.inspectDraft():method==='complete'?h.client.complete({}):h.client.completeManual({});
  await new Promise(r=>setImmediate(r));h.client.discardOnSessionEnd();
  pending.resolve(response(method==='inspectDraft'?{ok:true,code:'draft_ready',fields:{name:'private'}}:{ok:true,code:'profile_completed'}));
  assert.deepEqual(await operation,{ok:false,code:'session_changed'});
 });
}
