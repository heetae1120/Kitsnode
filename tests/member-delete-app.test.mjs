import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSupabaseMemberDeleteCandidate} from '../supabase/functions/kitsnode-member-delete/app.mjs';
test('uses verified auth user as only admin deletion target',async()=>{
 let target;const id='11111111-1111-4111-8111-111111111111',origin='https://heetae1120.github.io';
 const handler=createSupabaseMemberDeleteCandidate({enabled:true,allowedOrigins:[origin],allowRequest:async()=>true,authClient:{auth:{getUser:async token=>{assert.equal(token,'jwt');return {data:{user:{id,aud:'authenticated'}},error:null};}}},serviceClient:{rpc:async()=>({data:false,error:null}),auth:{admin:{deleteUser:async userId=>{target=userId;return {error:null};}}}}});
 const response=await handler(new Request('https://fixture.test/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer jwt'},body:JSON.stringify({confirm:'회원탈퇴'})}));
 assert.equal(response.status,200);assert.equal(target,id);
});
test('confirmed precheck blocks without admin call; races and precheck errors stay unavailable',async()=>{
 const id='11111111-1111-4111-8111-111111111111',origin='https://heetae1120.github.io';let calls=0,check=true;
 const handler=createSupabaseMemberDeleteCandidate({enabled:true,allowedOrigins:[origin],allowRequest:async()=>true,authClient:{auth:{getUser:async()=>({data:{user:{id,aud:'authenticated'}},error:null})}},serviceClient:{rpc:async()=>check==='error'?{data:null,error:{}}:{data:check,error:null},auth:{admin:{deleteUser:async()=>{calls++;return {error:{}};}}}}});
 const req=()=>new Request('https://fixture.test/functions/v1/kitsnode-member-delete',{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer jwt'},body:JSON.stringify({confirm:'회원탈퇴'})});
 let response=await handler(req());assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'deletion_blocked'});assert.equal(calls,0);
 check=false;assert.equal((await handler(req())).status,503);assert.equal(calls,1);
 check='error';assert.equal((await handler(req())).status,503);assert.equal(calls,1);
});
