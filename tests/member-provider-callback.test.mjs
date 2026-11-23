import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderCallbackCapture} from '../src/lib/member-provider-callback.mjs';
function setup(options){let listener;const auth={onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){listener=null}}}}}};const capture=createProviderCallbackCapture(auth,options);return {capture,emit:(...args)=>listener?.(...args)};}
const session=(id='one',access='first',provider='provider')=>({access_token:access,provider_token:provider,user:{id,identities:[{provider:'custom:naver'}]}});
test('captures a delayed OAuth callback once for the same member session',()=>{const {capture,emit}=setup();const s=session();emit('SIGNED_IN',s);assert.equal(capture.take(session('other')),null);assert.equal(capture.take(session('one','other')),null);assert.equal(capture.take(s),'provider');assert.equal(capture.take(s),null);capture.dispose()});
test('logout or session change removes transient provider token',()=>{const {capture,emit}=setup();const s=session();emit('SIGNED_IN',s);emit('SIGNED_OUT',null);assert.equal(capture.take(s),null);emit('SIGNED_IN',s);emit('TOKEN_REFRESHED',session('one','second',null));assert.equal(capture.take(s),null);capture.dispose()});
test('capture expires and ignores non Naver callbacks',async()=>{const {capture,emit}=setup({ttlMs:5});const s=session();emit('SIGNED_IN',{...s,user:{...s.user,identities:[]}});assert.equal(capture.take(s),null);emit('SIGNED_IN',s);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(capture.take(s),null);capture.dispose()});
