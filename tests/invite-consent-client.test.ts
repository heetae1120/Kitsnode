import test from 'node:test';
import assert from 'node:assert/strict';
import {createInviteConsentClient} from '../src/lib/invite-consent-client.mjs';
const options={enabled:true,version:'v1',policyDigest:'a'.repeat(64),policyUrl:'https://ads.naver.com/adguide/policy',disclosureUrl:'https://heetae1120.github.io/Kitsnode/policies/advertiser-consent-2026-11-21-v1.txt'};
test('consent client only enables with complete trusted configuration',()=>{
 assert.equal(createInviteConsentClient({...options,enabled:false}),undefined);
 assert.equal(createInviteConsentClient({...options,policyUrl:'https://ads.naver.com.example.com/'}),undefined);
 assert.equal(createInviteConsentClient({...options,policyDigest:'bad'}),undefined);
 assert.equal(createInviteConsentClient({...options,disclosureUrl:'https://ads.naver.com/adguide/policy'}),undefined);
 assert.equal(createInviteConsentClient({...options,disclosureUrl:options.disclosureUrl+'?changed=1'}),undefined);
 assert.ok(createInviteConsentClient(options));
});
test('records an account bound consent only at fixed endpoint',async()=>{
 let called=false;const client=createInviteConsentClient({...options,fetcher:async (input,init)=>{called=true;assert.equal(input,'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-api/invite-consents');assert.deepEqual(JSON.parse(String(init?.body)),{accountId:'123',accepted:true,version:'v1',policyDigest:'a'.repeat(64)});return Response.json({status:'recorded',consentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});}})!;
 await assert.rejects(client.record('fake.token','abc',new AbortController().signal));assert.equal(called,false);
 assert.deepEqual(await client.record('fake.token','123',new AbortController().signal),{status:'recorded',consentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});assert.equal(called,true);
});
