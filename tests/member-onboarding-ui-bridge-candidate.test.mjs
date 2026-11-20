import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberOnboardingUiBridgeCandidate as create} from '../src/lib/member-onboarding-ui-bridge-candidate.mjs';

const id='00000000-0000-4000-8000-000000000001';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}};
function fixture(overrides={}) {
 let generation=1, calls=[];
 const current=()=>({userId:id,sessionKey:`session-${generation}`,email:'verified@example.test',emailConfirmed:true,generation});
 const session={snapshot:async()=>current(),isCurrent:s=>s.generation===generation};
 const onboarding={checkUsername:async()=>({ok:true,code:'available'}),register:async()=>({ok:true,code:'signup_requested'}),signIn:async()=>({ok:true,code:'signed_in'}),inspectDraft:async()=>({ok:true,code:'draft_ready',fields:{email:'verified@example.test',name:'홍길동',username:'seller',phone:'01012345678'}})};
 const metadata={termsVersion:'v1',privacyVersion:'v2',termsSha256:'a'.repeat(64),privacySha256:'b'.repeat(64),revision:1};
 const documents={issue:async()=>({ok:true,documents:{terms:{version:'v1',body:'약관'},privacy:{version:'v2',body:'개인정보'},revision:1},metadata,receipt:'test.receipt.signature'})};
 const atomic={complete:async value=>{calls.push(value);return {ok:true,code:'profile_completed'}}};
 const bridge=create({enabled:true,environment:'synthetic',session,onboarding,documents,atomic,...overrides});
 const input={name:'홍길동',username:'seller',email:'verified@example.test',phone:'01012345678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true,termsVersion:'v1',privacyVersion:'v2'};
 return {bridge,session,onboarding,documents,atomic,input,calls,change:()=>{generation++}};
}
test('candidate is off by default and refuses missing dependencies or non-synthetic activation',()=>{
 assert.deepEqual(create(),{enabled:false});
 assert.throws(()=>create({enabled:true,environment:'synthetic'}),/invalid_candidate_configuration/);
 assert.throws(()=>create({enabled:true,environment:'production'}),/invalid_candidate_configuration/);
});
test('confirmed same session resumes draft and submits only its displayed document snapshot',async()=>{
 const f=fixture();const view=await f.bridge.resumeAfterEmailConfirmation();
 assert.equal(view.code,'prefill_ready');assert.equal(view.fields.username,'seller');assert.equal(view.documents.terms.body,'약관');
 assert.equal((await f.bridge.complete(f.input)).code,'profile_completed');assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].receipt,'test.receipt.signature');assert.equal(f.calls[0].documents.termsVersion,'v1');
 assert.equal((await f.bridge.complete(f.input)).code,'session_changed');
});
test('different browser or missing draft can use explicit authenticated manual recovery',async()=>{
 const f=fixture();f.onboarding.inspectDraft=async()=>({ok:false,code:'manual_completion_required'});
 const view=await f.bridge.resumeAfterEmailConfirmation();assert.equal(view.code,'manual_completion_required');assert.equal(view.fields,null);
 assert.equal((await f.bridge.complete(f.input)).code,'profile_completed');
});
test('verified email and exact independently accepted document versions are required',async()=>{
 const f=fixture();await f.bridge.resumeAfterEmailConfirmation();
 for(const altered of [{email:'other@example.test'},{termsVersion:'old'},{privacyVersion:'old'},{ageConfirmed:false}]) assert.equal((await f.bridge.complete({...f.input,...altered})).code,'invalid_input');
 assert.equal(f.calls.length,0);
});
test('late document response after session switch cannot restore prior member context',async()=>{
 const f=fixture(),pending=deferred();f.documents.issue=()=>pending.promise;
 const waiting=f.bridge.resumeAfterEmailConfirmation();await new Promise(r=>setImmediate(r));f.change();pending.resolve({ok:false});
 assert.equal((await waiting).code,'session_changed');assert.equal((await f.bridge.complete(f.input)).code,'session_changed');assert.equal(f.calls.length,0);
});
test('session change while completion is in flight suppresses old completion response',async()=>{
 const f=fixture(),pending=deferred();f.atomic.complete=()=>pending.promise;await f.bridge.resumeAfterEmailConfirmation();
 const waiting=f.bridge.complete(f.input);await new Promise(r=>setImmediate(r));f.change();pending.resolve({ok:true,code:'profile_completed'});
 assert.equal((await waiting).code,'session_changed');
});
test('document change requires a fresh snapshot instead of repeating old confirmation',async()=>{
 const f=fixture();f.atomic.complete=async()=>({ok:false,code:'document_changed'});await f.bridge.resumeAfterEmailConfirmation();
 assert.equal((await f.bridge.complete(f.input)).code,'document_changed');assert.equal((await f.bridge.complete(f.input)).code,'session_changed');
});
test('unknown write result does not claim failure or silently retry',async()=>{
 const f=fixture();let writes=0;f.atomic.complete=async()=>{writes++;throw Error('lost')};await f.bridge.resumeAfterEmailConfirmation();
 assert.equal((await f.bridge.complete(f.input)).code,'completion_unconfirmed');assert.equal((await f.bridge.complete(f.input)).code,'session_changed');assert.equal(writes,1);
});
test('a concurrent second submit does not repeat the pending write',async()=>{
 const f=fixture(),pending=deferred();let writes=0;f.atomic.complete=()=>{writes++;return pending.promise};await f.bridge.resumeAfterEmailConfirmation();
 const first=f.bridge.complete(f.input);assert.equal((await f.bridge.complete(f.input)).code,'busy');pending.resolve({ok:true,code:'profile_completed'});
 assert.equal((await first).code,'profile_completed');assert.equal(writes,1);
});
test('malformed or different-member draft is never sent to the completion screen',async()=>{
 const f=fixture();f.onboarding.inspectDraft=async()=>({ok:true,code:'draft_ready',fields:{email:'verified@example.test',name:{unsafe:true},username:'seller',phone:'01012345678'}});
 assert.equal((await f.bridge.resumeAfterEmailConfirmation()).code,'verification_required');
 f.onboarding.inspectDraft=async()=>({ok:true,code:'draft_ready',fields:{email:'other@example.test',name:'홍길동',username:'seller',phone:'01012345678'}});
 assert.equal((await f.bridge.resumeAfterEmailConfirmation()).code,'verification_required');
 assert.equal(f.calls.length,0);
});
