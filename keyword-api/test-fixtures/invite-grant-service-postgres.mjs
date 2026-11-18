// Only for the disposable local PostgreSQL fixture. Auth and advertiser
// authority are mocked; this is not proof of real account ownership.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createInviteGrantRepository} from '../src/invite-grant-supabase-repository.mjs';
import {createInviteGrantService} from '../src/invite-grant-service.mjs';
const literal=x=>`'${String(x).replaceAll("'","''")}'`;
function sql(q,service=true){return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',`${service?'set role service_role;':''}${q}`],{encoding:'utf8'}).trim();}
const fields={kits_invite_grant_issue:['p_request_id','p_user_id','p_session_id','p_nonce','p_account','p_viewer','p_revision','p_hash'],kits_invite_grant_consume:['p_hash','p_nonce','p_account','p_viewer']};
const repo=createInviteGrantRepository({async rpc(name,args){const argv=fields[name].map(k=>literal(args[k])).join(',');const query=name==='kits_invite_grant_consume'?`select coalesce(json_agg(row_to_json(t)),'[]'::json) from public.${name}(${argv}) t`:`select to_json(public.${name}(${argv}))`;return {data:JSON.parse(sql(query)),error:null};}});
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',requestId='eeeeeeee-3333-4333-8333-333333333333',nonce='eeeeeeee-4444-4444-8444-444444444444';
sql(`insert into kitsnode_ads_private.connections(id,user_id,ad_account_id) values ('${requestId}','${userId}','999')`,false);
sql(`select public.kits_ads_invite_consent('${requestId}','${userId}','kitsnode','OPERATIONS_MANAGER')`);
const request={requestId,userId,accountId:'999',status:'pending_review',consent:true,revision:0};
const svc=createInviteGrantService({auth:{verify:async()=>({userId,sessionId})},requests:{get:async()=>request},repository:repo,authorizeAdvertiser:async()=>true});
const issued=await svc.issue({token:'test-token',requestId,nonce,accountId:'999',viewerId:'advertiser'});
assert.equal(issued.status,'issued');
const payload={grant:issued.grant,nonce,accountId:'999',viewerId:'advertiser',recipientId:'kitsnode',role:'OPERATIONS_MANAGER'};
assert.equal((await svc.consume(payload)).approved,true);
assert.equal((await svc.consume(payload)).status,'blocked');
console.log('grant service + Supabase RPC adapter + disposable PostgreSQL: issuance and one-time consumption verified; identity simulated');
