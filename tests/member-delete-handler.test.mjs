import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMemberDeleteHandler} from '../supabase/functions/kitsnode-member-delete/handler.mjs';
const origin='https://heetae1120.github.io',id='11111111-1111-4111-8111-111111111111';
const request=(method,body,headers={})=>new Request('https://example.test/functions/v1/kitsnode-member-delete',{method,headers:{origin,...(body?{'content-type':'application/json',authorization:'Bearer fixture.token'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const defaults={enabled:true,allowedOrigins:[origin],verifySession:async()=>({id,aud:'authenticated'}),allowRequest:async()=>true,deleteMember:async()=> 'deleted'};
test('requires server-verified user and explicit confirmation; never accepts target id',async()=>{
 let target='';const handler=createMemberDeleteHandler({...defaults,deleteMember:async userId=>{target=userId;return 'deleted';}});
 assert.deepEqual(await (await handler(request('GET'))).json(),{available:true});
 assert.equal((await handler(request('POST',{confirm:'회원탈퇴',userId:'22222222-2222-4222-8222-222222222222'}))).status,400);
 assert.equal((await handler(request('POST',{confirm:'회원탈퇴'},{origin:'https://evil.test'}))).status,403);
 assert.equal((await handler(request('POST',{confirm:'회원탈퇴'},{authorization:'Bearer fake!'}))).status,401);
 assert.equal((await handler(request('POST',{confirm:'회원탈퇴'}))).status,200);assert.equal(target,id);
});
test('disabled, denied, anonymous, limited and backend-failure states are fail closed',async()=>{
 let calls=0;const handler=createMemberDeleteHandler({...defaults,enabled:false,deleteMember:async()=>{calls++;}});
 assert.deepEqual(await (await handler(request('GET'))).json(),{available:false});assert.equal((await handler(request('POST',{confirm:'회원탈퇴'}))).status,503);assert.equal(calls,0);
 for(const [override,status] of [[{verifySession:async()=>({id,aud:'authenticated',is_anonymous:true})},401],[{allowRequest:async()=>false},429],[{deleteMember:async()=> 'blocked'},409],[{deleteMember:async()=>{throw Error();}},503]])assert.equal((await createMemberDeleteHandler({...defaults,...override})(request('POST',{confirm:'회원탈퇴'}))).status,status);
});
