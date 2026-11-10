import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectIsolatedPublic} from './isolated-public-smoke.mjs';
const authOrigin='https://auth.example.test',frontendOrigin='https://front.example.test';
const docs={documents:[{type:'terms',version:'t1',text:'테스트 약관'},{type:'privacy',version:'p1',text:'synthetic privacy'}]};
const state={authenticated:false,consented:false,consentStatus:{terms:false,privacy:false},emailVerified:false,naverAvailable:true,emailVerificationAvailable:true};
function fake(payloads){let calls=0;return async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');assert.equal(init.headers.origin,frontendOrigin);assert.match(String(url),/^https:\/\/auth\.example\.test\/api\/member\/(terms|session)$/);const body=payloads[calls++];return Response.json(body,{headers:{'access-control-allow-origin':frontendOrigin,'access-control-allow-credentials':'true'}});};}
test('readiness probe accepts only synthetic anonymous document contract',async()=>{
 assert.deepEqual(await inspectIsolatedPublic({authOrigin,frontendOrigin,fetchImpl:fake([docs,state])}),{documents:2,anonymous:true,naverAvailable:true,emailVerificationAvailable:true});
 await assert.rejects(inspectIsolatedPublic({authOrigin:'http://auth.example.test',frontendOrigin,fetchImpl:fake([])}));
 await assert.rejects(inspectIsolatedPublic({authOrigin,frontendOrigin,fetchImpl:fake([{documents:[docs.documents[0],{type:'privacy',version:'p1',text:'Privacy'}]}])}),/test-only/);
 await assert.rejects(inspectIsolatedPublic({authOrigin,frontendOrigin,fetchImpl:fake([docs,{...state,authenticated:true}])}),/Anonymous/);
});
