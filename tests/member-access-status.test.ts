import test from 'node:test';
import assert from 'node:assert/strict';
import {memberAccessStatus} from '../src/components/store/member-access-status';

test('Naver member access does not claim email is verified',()=>{
 const status=memberAccessStatus({consented:true,memberAccess:true,emailVerified:false});
 assert.equal(status.message,'로그인과 필수 약관 동의가 완료되었습니다.');
 assert.equal(status.showRequiredEmail,false);
 assert.equal(status.showEmailSensitiveNote,true);
});
test('unverified member without access receives an email requirement',()=>{
 const status=memberAccessStatus({consented:true,memberAccess:false,emailVerified:false});
 assert.equal(status.showRequiredEmail,true);
 assert.equal(status.showEmailSensitiveNote,false);
 assert.match(status.message!,/확인/);
});
test('consent remains independent from member access',()=>{
 assert.equal(memberAccessStatus({consented:false,memberAccess:true,emailVerified:false}).message,null);
 assert.equal(memberAccessStatus({consented:false,memberAccess:true,emailVerified:false}).showEmailSensitiveNote,false);
 assert.equal(memberAccessStatus({consented:true,memberAccess:true,emailVerified:true}).showEmailSensitiveNote,false);
});
