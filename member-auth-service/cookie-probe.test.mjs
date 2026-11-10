import test from 'node:test';import assert from 'node:assert/strict';import {verifyProbeCookies,probe} from './cookie-probe.mjs';
test('probe requires two separate expected cookies',async()=>{
 const headers=new Headers();headers.append('set-cookie','kits_probe_a=1; Path=/; Secure; HttpOnly');headers.append('set-cookie','kits_probe_b=2; Path=/; Secure; HttpOnly');
 assert.equal(verifyProbeCookies(new Response('ok',{headers})),true);
 assert.equal(verifyProbeCookies(new Response('ok',{headers:{'set-cookie':'kits_probe_a=1, kits_probe_b=2'}})),false);
 await assert.rejects(probe('http://example.test/probe'));await assert.rejects(probe('https://example.test/probe?token=secret'));
});
