import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NAVER_INVITE_POLICY_ITEMS,NAVER_INVITE_POLICY_AGREEMENT,NAVER_INVITE_POLICY_CANONICAL,NAVER_INVITE_POLICY_DIGEST,NAVER_INVITE_POLICY_VERSION} from '../src/lib/naver-invite-policy.mjs';
test('the displayed Naver notice, acceptance label, version and pinned digest match',()=>{
 assert.equal(NAVER_INVITE_POLICY_ITEMS.length,4);
 assert.equal(NAVER_INVITE_POLICY_VERSION,'nav-invite-2026-11-21-v1');
 assert.equal(NAVER_INVITE_POLICY_CANONICAL,[...NAVER_INVITE_POLICY_ITEMS,NAVER_INVITE_POLICY_AGREEMENT].join('\n'));
 assert.equal(createHash('sha256').update(NAVER_INVITE_POLICY_CANONICAL,'utf8').digest('hex'),NAVER_INVITE_POLICY_DIGEST);
});
