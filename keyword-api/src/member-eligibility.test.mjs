import test from 'node:test';import assert from 'node:assert/strict';import {createMemberEligibility} from './member-eligibility.mjs';
const id='11111111-1111-4111-8111-111111111111';
const client=(row,error=null)=>({from(name){assert.equal(name,'kitsnode_member_consents');const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:row,error})};return q}});
test('requires current server-stored consent of exact authenticated user',async()=>{const make=x=>createMemberEligibility(client(x),{termsVersion:'v1',privacyVersion:'p1'});assert.equal(await make({user_id:id,accepted_at:'2026-01-01T00:00:00Z'})(id),true);assert.equal(await make({user_id:'22222222-2222-4222-8222-222222222222',accepted_at:'2026-01-01T00:00:00Z'})(id),false);assert.equal(await make(null)(id),false);assert.equal(await make({user_id:id,accepted_at:'no'})(id),false)});
test('invalid id and backend errors deny access',async()=>{const gate=createMemberEligibility(client(null,{code:'error'}),{termsVersion:'v1',privacyVersion:'p1'});assert.equal(await gate(id),false);assert.equal(await gate('bad'),false)});
test('staged legacy configuration recognizes only complete old or new consent pairs',async()=>{
 for(const [terms,privacy,expected] of [['2026-11-14','2026-11-14-naver',true],['2026-11-23','2026-11-23',true],['2026-11-14','2026-11-23',false]]){
  const db={from(){const filters={};return {select(){return this},eq(k,v){filters[k]=v;return this},async maybeSingle(){return {data:filters.terms_version===terms&&filters.privacy_version===privacy?{user_id:id,accepted_at:'2026-11-23T00:00:00Z'}:null,error:null}}}}};
  const gate=createMemberEligibility(db,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver'});
  assert.equal(await gate(id),expected);
 }
});
