import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmNaverInvitePolicy} from '../src/lib/naver-invite-policy-client.mjs';
import {NAVER_INVITE_POLICY_VERSION,NAVER_INVITE_POLICY_DIGEST} from '../src/lib/naver-invite-policy.mjs';
const consentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('confirmation is scoped to the exact displayed policy and fixed consent server',async()=>{
 let called=0;const fetcher=async(url:any,init:any)=>{called++;assert.equal(url,'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/policy-confirm');assert.deepEqual(JSON.parse(init.body),{consentId,naverPolicyVersion:NAVER_INVITE_POLICY_VERSION,naverPolicyDigest:`sha256:${NAVER_INVITE_POLICY_DIGEST}`});assert.equal(init.headers.Authorization,'Bearer token.value');assert.equal(init.credentials,'omit');return Response.json({status:'confirmed'});};
 assert.equal(await confirmNaverInvitePolicy({token:'token.value',consentId,signal:new AbortController().signal,fetcher}),true);assert.equal(called,1);
});
test('invalid inputs, rejected or ambiguous responses never confirm',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({status:'other'});};
 assert.equal(await confirmNaverInvitePolicy({token:'x',consentId:'bad',signal:new AbortController().signal,fetcher}),false);assert.equal(calls,0);
 assert.equal(await confirmNaverInvitePolicy({token:'x',consentId,signal:new AbortController().signal,fetcher}),false);assert.equal(calls,1);
});
