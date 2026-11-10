import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBundledTerms} from './terms-bundle.mjs';
test('bundled terms support long UTF-8 text and reject version or digest changes',()=>{
 const text='시험 약관\n'.repeat(3000), version='test-v1';
 const digest=createHash('sha256').update(text).digest('hex');
 assert.equal(verifyBundledTerms({version,text},version,digest),text);
 for (const [bundle,v,h] of [[null,version,digest],[{version,text:text+'x'},version,digest],[{version,text},'test-v2',digest],[{version,text},version,'bad']]) assert.throws(()=>verifyBundledTerms(bundle,v,h));
});
