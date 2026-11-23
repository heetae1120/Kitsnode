import test from 'node:test';
import assert from 'node:assert/strict';
import {createUsernameHandler} from '../supabase/functions/kitsnode-username-login/handler.mjs';
const origin='https://example.test';
function setup({confirmed=true,isPending=true,pendingError=false,limited=false}={}){
 let revoked=0;const handler=createUsernameHandler({origin,limit:async()=>!limited,lookup:async()=>null,dummyEmail:()=> 'missing@example.test',login:async()=>({user:{id:'user',email_confirmed_at:confirmed?'2026-01-01':null},session:{access_token:'access',refresh_token:'refresh'}}),pending:async()=>{if(pendingError)throw Error('failure');return isPending},revokeSession:async()=>{revoked++}});
 return {run:async()=>{const res=await handler(new Request(origin,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'resume',email:'person@example.test',password:'test-password'})}));return {status:res.status,...await res.json()}},revoked:()=>revoked};
}
test('verified pending account receives session',async()=>{const t=setup();assert.equal((await t.run()).code,'signed_in');assert.equal(t.revoked(),0)});
for(const opts of [{isPending:false},{confirmed:false},{pendingError:true}])test('completed, unverified or unavailable state never receives a session',async()=>{const t=setup(opts),r=await t.run();assert.equal(r.code,'sign_in_failed');assert.equal(r.session,undefined);assert.equal(t.revoked(),1)});
test('rate limited request is refused',async()=>{const t=setup({limited:true});assert.equal((await t.run()).status,429)});
