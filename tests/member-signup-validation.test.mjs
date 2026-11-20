import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMemberUsername, validateMemberSignup } from '../src/lib/member-signup-validation.mjs';

const valid = () => ({name:'홍길동',username:'Seller_01',password:'correct-horse',passwordConfirmation:'correct-horse',email:'seller@example.test',phone:'010-1234-5678',termsAccepted:true,privacyAccepted:true,ageConfirmed:true});

test('accepts the required signup fields without sending or returning credentials', () => {
  assert.deepEqual(validateMemberSignup(valid()), {valid:true,errors:{}});
  assert.equal(normalizeMemberUsername('  Seller_01 '), 'seller_01');
});
test('detects invalid fields and requires each consent independently', () => {
  const result = validateMemberSignup({...valid(),name:' ',username:'ab',email:'bad',phone:'010-12',passwordConfirmation:'different',termsAccepted:false,privacyAccepted:false,ageConfirmed:false});
  assert.deepEqual(Object.keys(result.errors).sort(), ['age','email','name','passwordConfirmation','phone','privacy','terms','username'].sort());
});
test('rejects an omitted confirmation even for matching empty passwords', () => {
  const result = validateMemberSignup({...valid(),password:'',passwordConfirmation:''});
  assert.equal(result.errors.password, 'invalid_password');
  assert.equal(result.errors.passwordConfirmation, 'password_mismatch');
});
test('accepts formatted mobile numbers without claiming identity verification', () => {
  assert.equal(validateMemberSignup({...valid(),phone:'010 1234 5678'}).valid,true);
  assert.equal(validateMemberSignup({...valid(),phone:'02-123-4567'}).errors.phone,'invalid_phone');
  assert.equal(validateMemberSignup({...valid(),phone:'010\t1234\t5678'}).errors.phone,'invalid_phone');
  assert.equal(validateMemberSignup({...valid(),phone:'\t01012345678'}).errors.phone,'invalid_phone');
});
