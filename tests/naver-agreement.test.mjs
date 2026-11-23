import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNaverAgreements} from '../supabase/functions/_shared/naver-agreement.mjs';

const config={providerToken:'test-token',expectedSubject:'subject',expectedClientId:'client',requiredTermCodes:['terms','privacy']};
const profile={resultcode:'00',response:{id:'subject'}};
const agreement={result:'success',agreementInfos:[{termCode:'terms',clientId:'client',agreeDate:'10:30:00.000 AM 11/23/2026'},{termCode:'privacy',clientId:'client',agreeDate:'10:30:00.000 AM 11/23/2026'}]};
function mock(p=profile,a=agreement){return async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer test-token');return Response.json(url.endsWith('/me')?p:a)}}
test('binds provider subject and requires all configured terms from the intended app',async()=>{
  const result=await verifyNaverAgreements({...config,fetchImpl:mock()});assert.equal(result.ok,true);assert.deepEqual(result.agreements.map(x=>x.termCode),['terms','privacy']);assert.ok(!JSON.stringify(result).includes('test-token'));
});
test('a different Naver identity is rejected before agreement lookup',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return Response.json({resultcode:'00',response:{id:'different'}})};
  assert.equal((await verifyNaverAgreements({...config,fetchImpl})).code,'identity_mismatch');assert.equal(calls,1);
});
test('missing, duplicate or wrong-client agreements fail closed',async()=>{
  for(const list of [[],[agreement.agreementInfos[0]],[...agreement.agreementInfos,agreement.agreementInfos[0]],agreement.agreementInfos.map(x=>({...x,clientId:'other'})),agreement.agreementInfos.map(x=>({...x,agreeDate:'not a date'}))]){
    assert.equal((await verifyNaverAgreements({...config,fetchImpl:mock(profile,{result:'success',agreementInfos:list})})).code,'missing_agreement');
  }
});
test('upstream failures and invalid configuration never establish consent',async()=>{
  assert.equal((await verifyNaverAgreements({...config,requiredTermCodes:[],fetchImpl:mock()})).code,'invalid_input');
  assert.equal((await verifyNaverAgreements({...config,providerToken:'bad\r\n',fetchImpl:mock()})).code,'invalid_input');
  assert.equal((await verifyNaverAgreements({...config,fetchImpl:async()=>{throw Error('secret message')}})).code,'unavailable');
});
