import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutoConnectCandidate} from '../../supabase/functions/kitsnode-ad-api/src/auto-connect-candidate.mjs';
function fixture(){let committed=0, accessible=true, owned=true, race=false; const row={requestId:'request',userId:'user',adAccountId:'2632357',status:'pending_review',revision:2}; const check=createAutoConnectCandidate({verifySession:async t=>t==='valid'?{id:'user'}:null,store:{getOwned:async()=>owned?row:null,approveVerified:async args=>{assert.equal(args.expectedRevision,2);if(race)return false;committed++;return true;}},resolveAccount:async()=>accessible?{ok:true,adAccountId:'2632357',customerId:'123',role:'READ_ONLY'}:{ok:false}});return {check,get committed(){return committed}, set accessible(v){accessible=v},set owned(v){owned=v},set race(v){race=v}};}
test('signed-in requester with Naver access becomes connected',async()=>{const f=fixture();assert.deepEqual(await f.check('valid','request'),{ok:true,status:'read_connected'});assert.equal(f.committed,1)});
test('inaccessible Naver account stays pending',async()=>{const f=fixture();f.accessible=false;assert.equal((await f.check('valid','request')).code,'naver_access_unverified');assert.equal(f.committed,0)});
test('other users and concurrent changes cannot approve',async()=>{const f=fixture();f.owned=false;assert.equal((await f.check('valid','request')).code,'not_found');f.owned=true;f.race=true;assert.equal((await f.check('valid','request')).code,'conflict');assert.equal(f.committed,0)});
test('a second member can claim an already accessible account before the rightful request is approved',async()=>{
 let winner=null;
 const rows={rightful:{requestId:'rightful',userId:'rightful-user',adAccountId:'2632357',status:'pending_review',revision:0},other:{requestId:'other',userId:'other-user',adAccountId:'2632357',status:'pending_review',revision:0}};
 const check=createAutoConnectCandidate({verifySession:async token=>({id:token}),store:{getOwned:async({requestId,userId})=>rows[requestId]?.userId===userId?rows[requestId]:null,approveVerified:async ({userId})=>{if(winner)return false;winner=userId;return true;}},resolveAccount:async()=>({ok:true,adAccountId:'2632357',customerId:'123',role:'READ_ONLY'})});
 assert.deepEqual(await check('other-user','other'),{ok:true,status:'read_connected'});
 assert.equal((await check('rightful-user','rightful')).code,'conflict');
 assert.equal(winner,'other-user');
});
