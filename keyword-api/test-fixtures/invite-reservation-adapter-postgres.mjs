// Only used with the disposable PostgreSQL started by the local test script.
import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createSupabaseInviteStore} from '../src/supabase-invite-store.mjs';
import {createInviteWorkflowReservation} from '../src/invite-workflow-reservation.mjs';
import {runLocalInviteWorkflow} from '../src/invite-local-workflow.mjs';
const [socket,port]=process.argv.slice(2);
if(!socket || !/^\d+$/.test(port??'')) throw Error('missing disposable database');
const exec=promisify(execFile), literal=x=>`'${String(x).replaceAll("'","''")}'`;
async function sql(q,service=true) {const {stdout}=await exec('psql',['-X','-qAt','-h',socket,'-p',port,'-d','postgres','-v','ON_ERROR_STOP=1','-c',`${service?'set role service_role; ':''}${q}`]);return stdout.trim()}
const fields={kits_ads_invite_job:['p_request_id'],kits_ads_invite_reserve:['p_request_id','p_user_id','p_ad_account_id','p_revision','p_recipient_id','p_role'],kits_ads_invite_finish:['p_request_id','p_outcome'],kits_ads_invite_consent:['p_request_id','p_user_id','p_recipient_id','p_role'],kits_ads_invite_revoke:['p_request_id','p_user_id']};
const store=createSupabaseInviteStore({async rpc(name,args){if(!Object.hasOwn(fields,name))throw Error('unexpected rpc');const argv=fields[name].map(key=>literal(args[key])).join(',');const query=name==='kits_ads_invite_job'?`select coalesce(json_agg(row_to_json(t)), '[]'::json) from public.${name}(${argv}) t`:`select to_json(public.${name}(${argv}))`;return {data:JSON.parse(await sql(query)),error:null}}});
const userId='44444444-4444-4444-8444-444444444444', requestId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const bound={requestId,accountId:'777',advertiserId:'advertiser',recipientId:'recipient',role:'OPERATIONS_MANAGER'};
await sql(`insert into auth.users values (${literal(userId)}); insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values (${literal(requestId)},${literal(userId)},'777')`,false);
assert.equal(await store.consent({requestId,userId,recipientId:bound.recipientId,role:bound.role}),true);
const one=createInviteWorkflowReservation({store,userId,...bound}),two=createInviteWorkflowReservation({store,userId,...bound});
const results=await Promise.all([one.reserve(bound),two.reserve(bound)]);
assert.deepEqual([...results].sort(),[false,true]);
const winner=results[0]?one:two,loser=results[0]?two:one;
assert.equal(await loser.finish({...bound,outcome:'pending_review'}),false);
assert.equal(await winner.isCurrent(bound),true);
assert.equal(await store.revoke({requestId,userId}),true);
assert.equal(await winner.isCurrent(bound),false);
assert.equal(await winner.finish({...bound,outcome:'uncertain'}),true);
assert.equal(await sql(`select outcome from kitsnode_ads_private.invite_attempts where connection_id=${literal(requestId)}`,false),'uncertain');
assert.equal(await winner.reserve(bound),false);
const second='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
await sql(`insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values (${literal(second)},${literal(userId)},'888')`,false);
const job={...bound,requestId:second,accountId:'888'};
assert.equal(await store.consent({requestId:second,userId,recipientId:job.recipientId,role:job.role}),true);
const reservation=createInviteWorkflowReservation({store,userId,...job});
let sent=0,accepted=0;
const evidence={pending:async()=>({...job,verified:true,status:'pending',invitationId:'fixture-only'}),accepted:async()=>({...job,verified:true,status:'accepted',invitationId:'fixture-only'})};
const outcome=await runLocalInviteWorkflow({...job,reservation,evidence,
 onWindowReady:async()=>{},onPolicyReview:async()=>true,authorize:async()=>true,
 openSessions:async()=>({advertiser:{},recipient:{},close:async()=>{}}),
 verifyRecipient:async()=>true,prepareDialog:async()=>({status:'dialog_open_requested'}),
 createInvite:()=>({prepareRecipient:async()=>({status:'ready'}),send:async()=>{sent++;return {status:'uncertain'}}}),
 createAccept:()=>({accept:async()=>{accepted++;return {status:'uncertain'}}})});
assert.deepEqual(outcome,{status:'pending_review',retry:'disabled'});
assert.equal(sent,1);assert.equal(accepted,1);
assert.equal(await sql(`select outcome from kitsnode_ads_private.invite_attempts where connection_id=${literal(second)}`,false),'pending_review');
console.log('workflow + reservation adapter + store + disposable PostgreSQL: binding, concurrency, revocation and durable result verified; login, identity and Naver simulated');
