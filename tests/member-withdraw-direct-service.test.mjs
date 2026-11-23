import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirectWithdrawal} from '../supabase/functions/kitsnode-member-withdraw/direct-service.mjs';
const member='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',admin='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('sends server operators and caller subject without external lookup',async()=>{
 const calls=[];const f=createDirectWithdrawal({readOperators:()=>admin,supabase:{rpc:async(...args)=>{calls.push(args);return {data:'complete'}}}});
 assert.deepEqual(await f(member),{status:'complete'});
 assert.deepEqual(calls,[['kits_customer_withdraw_direct',{p_subject:member,p_operator_ids:[admin]}]]);
});
test('invalid or changing operator configuration fails closed',async()=>{
 for(const raw of ['', 'invalid', `${admin},${admin}`]){let calls=0;const f=createDirectWithdrawal({readOperators:()=>raw,supabase:{rpc:async()=>{calls++;return {data:'complete'}}}});assert.deepEqual(await f(member),{status:'pending'});assert.equal(calls,0)}
 let reads=0,calls=0;const f=createDirectWithdrawal({readOperators:()=>reads++?member:admin,supabase:{rpc:async()=>{calls++;return {data:'complete'}}}});assert.deepEqual(await f(member),{status:'pending'});assert.equal(calls,0);
});
test('protected references and DB failures do not claim completion',async()=>{
 for(const [response,status] of [[{data:'protected_reference'},'protected_reference'],[{data:'admin_protected'},'admin_protected'],[{error:true},'pending']]){
  const f=createDirectWithdrawal({readOperators:()=>admin,supabase:{rpc:async()=>response}});
  assert.deepEqual(await f(member),{status});
 }
});
