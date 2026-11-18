import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseInviteStore} from './supabase-invite-store.mjs';
const requestId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222';
test('maps persisted consent and binds the exact reservation arguments',async()=>{
 const calls=[];const store=createSupabaseInviteStore({rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='kits_ads_invite_job'?[{user_id:userId,ad_account_id:'123',state:'pending_review',consent:true,revision:'0:1'}]:true}}});
 assert.deepEqual(await store.getJob(requestId),{userId,adAccountId:'123',state:'pending_review',consent:true,revision:'0:1'});
 assert.equal(await store.reserve({requestId,userId,adAccountId:'123',revision:'0:1',recipientId:'kits',role:'OPERATIONS_MANAGER'}),true);
 assert.deepEqual(calls[1][1],{p_request_id:requestId,p_user_id:userId,p_ad_account_id:'123',p_revision:'0:1',p_recipient_id:'kits',p_role:'OPERATIONS_MANAGER'});
});
test('rejects malformed data, invalid identity and unconfirmed finalization',async()=>{
 const store=createSupabaseInviteStore({rpc:async(name)=>({data:name==='kits_ads_invite_job'?[{user_id:userId,ad_account_id:'1',state:'pending_review',consent:'true',revision:'0:0'}]:false})});
 await assert.rejects(()=>store.getJob(requestId),/invalid_response/);
 await assert.rejects(()=>store.consent({requestId,userId:'invalid'}),/invalid_identity/);
 await assert.rejects(()=>store.finish(requestId,'uncertain'),/audit_unconfirmed/);
});
