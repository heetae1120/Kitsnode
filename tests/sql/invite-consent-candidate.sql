\set ON_ERROR_STOP on
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key);
\ir ../fixtures/invite-consent/schema-candidate.sql
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select kitsnode_ads_private.record_invite_consent_candidate('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','123','v1',repeat('a',64));
do $$declare good uuid:='11111111-1111-4111-8111-111111111111'; bad uuid:='22222222-2222-4222-8222-222222222222'; c uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; u uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; rid uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'; begin
 if has_function_privilege('authenticated','kitsnode_ads_private.record_invite_consent_candidate(uuid,uuid,uuid,text,text,text)','execute') or has_schema_privilege('authenticated','kitsnode_ads_private','usage') then raise exception 'unexpected client privilege'; end if;
 if kitsnode_ads_private.reserve_invite_consent_candidate(c,u,bad,'123','v1',repeat('a',64),rid) then raise exception 'wrong session reserved'; end if;
 if kitsnode_ads_private.reserve_invite_consent_candidate(c,u,good,'456','v1',repeat('a',64),rid) then raise exception 'wrong account reserved'; end if;
 if kitsnode_ads_private.reserve_invite_consent_candidate(c,u,good,'123','v2',repeat('a',64),rid) then raise exception 'wrong version reserved'; end if;
 if not kitsnode_ads_private.reserve_invite_consent_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 'valid reserve rejected'; end if;
 if not kitsnode_ads_private.release_invite_consent_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 'safe pre-send recovery failed'; end if;
 if not kitsnode_ads_private.reserve_invite_consent_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 're-reserve rejected'; end if;
 if not kitsnode_ads_private.begin_invite_send_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 'begin rejected'; end if;
 if kitsnode_ads_private.release_invite_consent_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 'attempted send released'; end if;
 if kitsnode_ads_private.reserve_invite_consent_candidate(c,u,good,'123','v1',repeat('a',64),rid) then raise exception 'consent replayed'; end if;
end $$;
insert into kitsnode_ads_private.invite_consent_candidate(id,user_id,session_id,ad_account_id,consent_version,policy_digest,recipient,role,auto_policy,created_at,expires_at) values ('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','123','v1',repeat('a',64),'kitsnode','OPERATIONS_VIEWER',true,now()-interval '20 minutes',now()-interval '10 minutes');
do $$begin if kitsnode_ads_private.reserve_invite_consent_candidate('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','123','v1',repeat('a',64),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'expired reserved'; end if; end $$;
insert into kitsnode_ads_private.invite_consent_candidate(id,user_id,session_id,ad_account_id,consent_version,policy_digest,recipient,role,auto_policy,revoked_at) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','123','v1',repeat('a',64),'kitsnode','OPERATIONS_VIEWER',true,now());
do $$begin if kitsnode_ads_private.reserve_invite_consent_candidate('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','123','v1',repeat('a',64),'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'revoked reserved'; end if; end $$;
