import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSensMailSender,createSmtpMailSender} from './mail.mjs';

const common = {from:'sender@example.test',authBaseURL:'https://auth.example.test',redirectOrigins:['https://app.example.test']};
const request = {to:'member@example.test',kind:'verification',url:'https://auth.example.test/api/auth/verify-email?token=synthetic&callbackURL=https%3A%2F%2Fapp.example.test%2Fstore%2Flogin%2F'};

test('SENS MAIL sends one addressed transactional request with the exact signed path', async () => {
  let seen;
  const send = createSensMailSender({...common,serviceId:'ncp:mail:kr:123:main',accessKey:'fixture_access',secretKey:'fixture_secret',clock:()=>1700000000000,fetchImpl:async (url,options)=>{seen={url,options}; return Response.json({requestId:'synthetic-request-id',requestCount:1},{status:202});}});
  assert.deepEqual(await send(request),{accepted:true,requestId:'synthetic-request-id'});
  const path='/mail/v2/services/ncp:mail:kr:123:main/requests';
  assert.equal(seen.url,`https://sens.apigw.ntruss.com${path}`);
  assert.equal(seen.options.redirect,'error');
  assert.equal(seen.options.headers['x-ncp-apigw-signature-v2'],createHmac('sha256','fixture_secret').update(`POST ${path}\n1700000000000\nfixture_access`).digest('base64'));
  const body=JSON.parse(seen.options.body);
  assert.deepEqual(body.recipients,[{address:'member@example.test',type:'TO'}]);
  assert.equal(body.senderAddress,common.from); assert.equal(body.individual,true); assert.equal(body.advertising,false);
  assert.ok(body.body.includes('&amp;callbackURL='));
  assert.ok(!JSON.stringify(body).includes('fixture_secret'));
});

test('mail sender rejects unsafe addresses, paths, redirects and ambiguous parameters before sending', async () => {
  let calls=0;
  const send = createSensMailSender({...common,serviceId:'ncp:mail:kr:123:main',accessKey:'fixture',secretKey:'fixture',clock:()=>1700000000000,fetchImpl:async()=>{calls++;return new Response('{}',{status:202});}});
  for (const bad of [
    {...request,to:'member@example.test,other@example.test'},
    {...request,to:'member@example.test\r\nBcc:other@example.test'},
    {...request,url:'https://evil.example.test/api/auth/verify-email?token=x'},
    {...request,url:'https://auth.example.test/redirect?token=x'},
    {...request,url:'https://auth.example.test/api/auth/verify-email'},
    {...request,url:'https://auth.example.test/api/auth/verify-email?token=x&token=y'},
    {...request,url:'https://auth.example.test/api/auth/verify-email?token=x&callbackURL=https%3A%2F%2Fevil.example.test'},
    {...request,url:'https://auth.example.test/api/auth/verify-email?token=x&callbackURL=%2F%2Fevil.example.test'},
  ]) await assert.rejects(send(bad),/Invalid mail request/);
  assert.equal(calls,0);
  assert.throws(()=>createSensMailSender({...common,serviceId:'../evil',accessKey:'a',secretKey:'b'}),/configuration/);
  assert.throws(()=>createSensMailSender({...common,authBaseURL:'http://auth.example.test',serviceId:'x',accessKey:'a',secretKey:'b'}),/configuration/);
});

test('SENS acknowledges only acceptance, does not retry and masks provider errors', async () => {
  let calls=0;
  const send = createSensMailSender({...common,serviceId:'x',accessKey:'a',secretKey:'s',clock:()=>1700000000000,fetchImpl:async()=>{calls++;throw new Error('sensitive provider response');}});
  await assert.rejects(send(request),{message:'Mail delivery failed'});
  assert.equal(calls,1);
  const failed = createSensMailSender({...common,serviceId:'x',accessKey:'a',secretKey:'s',clock:()=>1700000000000,fetchImpl:async()=>new Response('secret',{status:400})});
  await assert.rejects(failed(request),{message:'Mail delivery failed'});
  const malformed = createSensMailSender({...common,serviceId:'x',accessKey:'a',secretKey:'s',clock:()=>1700000000000,fetchImpl:async()=>new Response('secret',{status:202})});
  await assert.rejects(malformed(request),{message:'Mail delivery failed'});
  const wrongCount = createSensMailSender({...common,serviceId:'x',accessKey:'a',secretKey:'s',clock:()=>1700000000000,fetchImpl:async()=>Response.json({requestId:'fixture',requestCount:2},{status:202})});
  await assert.rejects(wrongCount(request),{message:'Mail delivery failed'});
  const redirect = createSensMailSender({...common,serviceId:'x',accessKey:'a',secretKey:'s',clock:()=>1700000000000,fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.example.test/'}})});
  await assert.rejects(redirect(request),{message:'Mail delivery failed'});
});

test('SMTP does not surface provider secrets and detects rejection', async () => {
  const send=createSmtpMailSender({...common,host:'smtp.example.test',port:587,user:'fixture',password:'fixture',transport:{sendMail:async()=>({rejected:['member@example.test']})}});
  await assert.rejects(send(request),{message:'Mail delivery failed'});
});
