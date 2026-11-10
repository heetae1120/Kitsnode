import test from 'node:test';
import assert from 'node:assert/strict';
import {createEdgeRateLimits} from './edge-rate-limit.mjs';

test('separate IP and account buckets use keyed, non-plaintext identifiers',async()=>{
  const seen=[];
  const limiter={limit:async ({key})=>{seen.push(key);return {success:true}}};
  const limits=createEdgeRateLimits({ipLimiter:limiter,accountLimiter:limiter,secret:'a'.repeat(32)});
  await limits.ip(new Request('https://example.test/',{headers:{'cf-connecting-ip':'192.0.2.1','x-forwarded-for':'192.0.2.9'}}));
  await limits.ip(new Request('https://example.test/',{headers:{'cf-connecting-ip':'192.0.2.2'}}));
  await limits.account('fixture-user-a');await limits.account('fixture-user-b');
  assert.equal(new Set(seen).size,4);assert.ok(seen.every(value=>/^[a-f0-9]{64}$/.test(value)));
  assert.ok(seen.every(value=>!value.includes('fixture')&&!value.includes('192.0.2')));
});

test('IPv6 representations share a bucket; invalid IP and missing configuration fail closed',async()=>{
  const seen=[];const limiter={limit:async ({key})=>{seen.push(key);return {success:true}}};
  const limits=createEdgeRateLimits({ipLimiter:limiter,accountLimiter:limiter,secret:'b'.repeat(32)});
  for (const ip of ['2001:db8::1','2001:0db8:0:0:0:0:0:1']) await limits.ip(new Request('https://example.test/',{headers:{'cf-connecting-ip':ip}}));
  assert.equal(seen[0],seen[1]);
  await assert.rejects(limits.ip(new Request('https://example.test/',{headers:{'x-forwarded-for':'192.0.2.1'}})));
  assert.throws(()=>createEdgeRateLimits({ipLimiter:limiter,accountLimiter:limiter,secret:'short'}));
});

test('limiter errors propagate and denied requests are reported',async()=>{
  const limits=createEdgeRateLimits({ipLimiter:{limit:async()=>({success:false})},accountLimiter:{limit:async()=>{throw Error('offline')}},secret:'c'.repeat(32)});
  assert.equal(await limits.ip(new Request('https://example.test/',{headers:{'cf-connecting-ip':'192.0.2.1'}})),false);
  await assert.rejects(limits.account('fixture-user'));
});
