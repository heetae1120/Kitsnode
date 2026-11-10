import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedSmtp} from './isolated-smtp.mjs';
test('test SMTP sends only the allowed mailbox a loopback verification link',async()=>{
 let calls=0;
 const sender=createIsolatedSmtp({user:'sender@naver.com',password:'fake',recipient:'recipient@naver.com',transport:{sendMail:async()=>{calls++;return {accepted:['recipient@naver.com'],rejected:[]}}}});
 const valid={to:'recipient@naver.com',kind:'verification',url:'http://127.0.0.1:4323/api/auth/verify-email?token=synthetic&callbackURL=http%3A%2F%2F127.0.0.1%3A4324%2Fstore%2Flogin%2F'};
 await sender(valid);assert.equal(calls,1);
 await assert.rejects(sender({...valid,to:'other@naver.com'}));
 await assert.rejects(sender({...valid,url:'https://example.test/api/auth/verify-email?token=synthetic'}));
 await assert.rejects(sender({...valid,kind:'reset'}));assert.equal(calls,1);
});
test('SMTP verification reports only the safe error class',async()=>{
 let failure;
 const error=Object.assign(new Error('secret should never be logged'),{code:'EAUTH',responseCode:535});
 const sender=createIsolatedSmtp({user:'sender@naver.com',password:'fake',recipient:'recipient@naver.com',transport:{verify:async()=>{throw error}},onFailure:value=>{failure=value}});
 await assert.rejects(sender.verify(),/authentication failed/);
 assert.deepEqual(failure,{code:'EAUTH',responseCode:535});
});
